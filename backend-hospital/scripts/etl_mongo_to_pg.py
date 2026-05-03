"""
MongoDB → PostgreSQL ETL Migration Script
==========================================
Compatible with Python 3.8+. Column names match Flyway V1__baseline_postgres.sql.

Migrates collections listed in docs/migration/MONGO_TO_POSTGRES_INVENTORY.md.

Run from repo root or this directory:
  pip install pymongo psycopg2-binary tqdm
  export MONGO_URI=... MONGO_DB=flexshell MONGO_RAG_DB=rag_db PG_DSN=...
  python etl_mongo_to_pg.py

Mongo field names follow Java @Field annotations (mostly PascalCase).
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

import psycopg2
import psycopg2.extras
from pymongo import MongoClient
from tqdm import tqdm

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB = os.getenv("MONGO_DB", "flexshell")
MONGO_RAG_DB = os.getenv("MONGO_RAG_DB", "rag_db")
PG_DSN = os.getenv("PG_DSN", "")


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def get_mongo(uri: str, db_name: str):
    client = MongoClient(uri, serverSelectionTimeoutMS=10_000)
    return client[db_name]


def get_pg(dsn: str):
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    return conn


def oid(val: Any) -> Optional[str]:
    if val is None:
        return None
    return str(val)


def ts(val: Any) -> Optional[datetime]:
    """Mongo / BSON date → timezone-aware datetime for PG timestamptz."""
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    if isinstance(val, dict) and "$date" in val:
        inner = val["$date"]
        if isinstance(inner, (int, float)):
            return datetime.fromtimestamp(inner / 1000.0, tz=timezone.utc)
        if isinstance(inner, str):
            return datetime.fromisoformat(inner.replace("Z", "+00:00"))
    return None


def jdump(val: Any) -> Optional[str]:
    if val is None:
        return None
    return json.dumps(val, default=str)


def g(doc: Dict[str, Any], *keys: str, default=None):
    """First present key wins (supports PascalCase + camelCase fallbacks)."""
    for k in keys:
        if k in doc and doc[k] is not None:
            return doc[k]
    return default


def str_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def bool_or(d: Dict[str, Any], *keys: str, default: bool = False) -> bool:
    v = g(d, *keys, default=None)
    if v is None:
        return default
    return bool(v)


def int_or(d: Dict[str, Any], *keys: str, default: int = 0) -> int:
    v = g(d, *keys, default=None)
    if v is None:
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def slug_code(name: Optional[str], fallback: str) -> str:
    if name and str(name).strip():
        s = re.sub(r"[^a-zA-Z0-9]+", "-", str(name).strip().lower()).strip("-")
        if s:
            return s[:64]
    return fallback[:64]


def prescription_files_json(files: Any) -> str:
    """Strip binary Data from appointment file blobs for JSONB."""
    if not files:
        return "[]"
    out: List[Any] = []
    for f in files:
        if not isinstance(f, dict):
            continue
        fc = {k: v for k, v in f.items() if k not in ("Data", "data")}
        out.append(fc)
    return json.dumps(out, default=str)


def weekly_json(doc: Dict[str, Any]) -> str:
    w = g(doc, "Weekly", "weekly", default={}) or {}
    return json.dumps(w, default=str)


def validate(mongo_col, pg_conn, pg_table: str, label: str = "") -> None:
    mongo_count = mongo_col.count_documents({})
    cur = pg_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM %s" % pg_table)
    pg_count = cur.fetchone()[0]
    cur.close()
    ok = "OK" if mongo_count == pg_count else "MISMATCH"
    print("  [{}] {} mongo={}  pg={}".format(ok, label, mongo_count, pg_count))


def _bulk_execute(pg_conn, sql: str, rows: List, table: str) -> None:
    if not rows:
        print("  No documents found in {}, skipping.".format(table))
        return
    cur = pg_conn.cursor()
    psycopg2.extras.execute_batch(cur, sql, rows, page_size=500)
    pg_conn.commit()
    cur.close()
    print("  -> {} rows inserted into {}".format(len(rows), table))


def fetch_pg_user_ids(pg_conn) -> Set[str]:
    """IDs present in users after migrate_users (refresh_tokens.user_id FK)."""
    cur = pg_conn.cursor()
    cur.execute("SELECT id FROM users")
    ids = {str(r[0]) for r in cur.fetchall() if r and r[0] is not None}
    cur.close()
    return ids


def fetch_pg_appointment_ids(pg_conn) -> Set[str]:
    """IDs present in appointments after migrate_appointments (structured_prescriptions FK)."""
    cur = pg_conn.cursor()
    cur.execute("SELECT id FROM appointments")
    ids = {str(r[0]) for r in cur.fetchall() if r and r[0] is not None}
    cur.close()
    return ids


# ---------------------------------------------------------------------------
# 1. users  (PascalCase Mongo fields — UserEntity)
# ---------------------------------------------------------------------------
def migrate_users(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["users"].find())
    rows = []
    for d in tqdm(docs, desc="users"):
        role = g(d, "Role", "role", default="PATIENT")
        req_role = g(d, "RequestedRole", "requestedRole", default=None)
        rows.append(
            (
                oid(d["_id"]),
                str_or_none(g(d, "Username", "username")),
                str_or_none(g(d, "Email", "email")),
                str_or_none(g(d, "FirstName", "firstName")),
                str_or_none(g(d, "LastName", "lastName")),
                str_or_none(g(d, "Password", "password", "passwordHash")),
                str_or_none(g(d, "Address", "address")),
                str_or_none(g(d, "Gender", "gender")),
                str_or_none(g(d, "MobileNumber", "mobileNumber", "phone")),
                str_or_none(g(d, "Department", "department")),
                str_or_none(g(d, "Qualifications", "qualifications")),
                str_or_none(g(d, "SmcName", "smcName")),
                str_or_none(g(d, "SmcRegistrationNumber", "smcRegistrationNumber")),
                ts(g(d, "CreatedTimestamp", "createdAt", "created_at")),
                ts(g(d, "UpdatedTimestamp", "updatedAt", "updated_at")),
                bool_or(d, "Active", "active", default=True),
                int_or(d, "TokenVersion", "tokenVersion", default=1),
                str(role) if role is not None else "PATIENT",
                str(g(d, "RoleStatus", "roleStatus", default="ACTIVE") or "ACTIVE"),
                str(req_role) if req_role is not None else None,
                ts(g(d, "RoleRequestedAt", "roleRequestedAt")),
                ts(g(d, "RoleDecisionAt", "roleDecisionAt")),
                str_or_none(g(d, "RoleDecisionBy", "roleDecisionBy")),
                str_or_none(g(d, "RoleRejectedReason", "roleRejectedReason")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO users (
            id, username, email, first_name, last_name, password_hash,
            address, gender, mobile_number, department, qualifications,
            smc_name, smc_registration_number, created_at, updated_at,
            active, token_version, role, role_status, requested_role,
            role_requested_at, role_decision_at, role_decision_by,
            role_rejected_reason, deleted
        )
        VALUES (
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        )
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "users")
    validate(mongo_db["users"], pg_conn, "users", "users")


# ---------------------------------------------------------------------------
# 2. medical_departments  (MedicalDepartmentEntity — Code NOT NULL in PG)
# ---------------------------------------------------------------------------
def migrate_medical_departments(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["medical-department"].find())
    rows = []
    for d in tqdm(docs, desc="medical_departments"):
        iid = oid(d["_id"])
        code = str_or_none(g(d, "Code", "code"))
        if not code:
            code = slug_code(str_or_none(g(d, "Name", "name")), "dept-" + (iid or "x"))
        rows.append(
            (
                iid,
                str_or_none(g(d, "Name", "name")),
                code,
                str_or_none(g(d, "Description", "description")),
                bool_or(d, "Active", "active", default=True),
                ts(g(d, "CreatedTimestamp", "createdAt")),
                ts(g(d, "UpdatedTimestamp", "updatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO medical_departments
            (id, name, code, description, active, created_at, updated_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "medical_departments")
    validate(mongo_db["medical-department"], pg_conn, "medical_departments", "medical_departments")


# ---------------------------------------------------------------------------
# 3. doctor_schedules  (no created_at in PG)
# ---------------------------------------------------------------------------
def migrate_doctor_schedules(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["doctorSchedule"].find())
    rows = []
    for d in tqdm(docs, desc="doctor_schedules"):
        rows.append(
            (
                oid(d["_id"]),
                oid(g(d, "DoctorId", "doctorId")),
                weekly_json(d),
                str_or_none(g(d, "UpdatedBy", "updatedBy")),
                ts(g(d, "UpdatedAt", "updatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO doctor_schedules
            (id, doctor_id, weekly, updated_by, updated_at, deleted)
        VALUES (%s,%s,%s::jsonb,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "doctor_schedules")
    validate(mongo_db["doctorSchedule"], pg_conn, "doctor_schedules", "doctor_schedules")


# ---------------------------------------------------------------------------
# 4. appointments
# ---------------------------------------------------------------------------
def migrate_appointments(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["appointment"].find())
    rows = []
    for d in tqdm(docs, desc="appointments"):
        files = g(d, "PrescriptionFiles", "prescriptionFiles", default=[]) or []
        rows.append(
            (
                oid(d["_id"]),
                str_or_none(g(d, "PatientName", "patientName")),
                str_or_none(g(d, "Email", "email")),
                str_or_none(g(d, "PhoneNumber", "phoneNumber")),
                str_or_none(g(d, "AgeGroup", "ageGroup")),
                str_or_none(g(d, "Department", "department")),
                oid(g(d, "DoctorId", "doctorId")),
                str_or_none(g(d, "DoctorName", "doctorName")),
                str_or_none(g(d, "PreferredDate", "preferredDate")),
                str_or_none(g(d, "PreferredTimeSlot", "preferredTimeSlot")),
                str_or_none(g(d, "AdditionalNotes", "additionalNotes")),
                str_or_none(g(d, "Status", "status")),
                prescription_files_json(files),
                ts(g(d, "CreatedTimestamp", "createdAt")),
                ts(g(d, "UpdatedTimestamp", "updatedAt")),
                oid(g(d, "CreatedBy", "createdBy")),
                oid(g(d, "UpdatedBy", "updatedBy")),
                str_or_none(g(d, "AppointmentEmailNotifyStatus", "appointmentEmailNotifyStatus")),
                g(d, "AppointmentEmailNotifyFailed", "appointmentEmailNotifyFailed", default=None),
                str_or_none(g(d, "AppointmentEmailNotifyDetail", "appointmentEmailNotifyDetail")),
                ts(g(d, "AppointmentEmailNotifyAt", "appointmentEmailNotifyAt")),
                str_or_none(g(d, "CallStatus", "callStatus")),
                ts(g(d, "CallStartTime", "callStartTime")),
                ts(g(d, "CallEndTime", "callEndTime")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO appointments (
            id, patient_name, email, phone_number, age_group, department,
            doctor_id, doctor_name, preferred_date, preferred_time_slot,
            additional_notes, status, prescription_files, created_at, updated_at,
            created_by, updated_by, appointment_email_notify_status,
            appointment_email_notify_failed, appointment_email_notify_detail,
            appointment_email_notify_at, call_status, call_start_time, call_end_time,
            deleted
        )
        VALUES (
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        )
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "appointments")
    validate(mongo_db["appointment"], pg_conn, "appointments", "appointments")


# ---------------------------------------------------------------------------
# 5. structured_prescriptions
# ---------------------------------------------------------------------------
def _bytes_field(d: Dict[str, Any], *keys: str) -> Any:
    v = g(d, *keys, default=None)
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray, memoryview)):
        return bytes(v)
    if isinstance(v, str):
        try:
            return bytes.fromhex(v)
        except ValueError:
            return v.encode("utf-8", errors="replace")
    return None


def migrate_structured_prescriptions(mongo_db, pg_conn) -> None:
    valid_appts = fetch_pg_appointment_ids(pg_conn)
    valid_users = fetch_pg_user_ids(pg_conn)
    docs = list(mongo_db["structuredPrescription"].find())
    rows = []
    skipped_appt = 0
    skipped_appt_ids: Set[str] = set()
    nulled_prescriber = 0
    for d in tqdm(docs, desc="structured_prescriptions"):
        appt_id = str_or_none(oid(g(d, "AppointmentId", "appointmentId")))
        if not appt_id or appt_id not in valid_appts:
            skipped_appt += 1
            if appt_id:
                skipped_appt_ids.add(appt_id)
            continue
        presc = str_or_none(oid(g(d, "PrescriberUserId", "prescriberUserId", "DoctorId", "doctorId")))
        if presc and presc not in valid_users:
            presc = None
            nulled_prescriber += 1
        audit = g(d, "AuditLog", "auditLog", default=[]) or []
        sig_meta = g(d, "SignatureMetadata", "signatureMetadata", default={}) or {}
        rows.append(
            (
                oid(d["_id"]),
                appt_id,
                presc,
                str_or_none(g(d, "Status", "status", default="DRAFT")) or "DRAFT",
                str_or_none(g(d, "TemplateVersion", "templateVersion")),
                jdump(g(d, "DraftPayload", "draftPayload", "draft", default={}) or {}),
                jdump(g(d, "SignedPayload", "signedPayload", "signed", default={}) or {}),
                _bytes_field(d, "PdfBytes", "pdfBytes"),
                _bytes_field(d, "PdfBytesCipher", "pdfBytesCipher"),
                _bytes_field(d, "DraftPayloadCipher", "draftPayloadCipher"),
                _bytes_field(d, "SignedPayloadCipher", "signedPayloadCipher"),
                str_or_none(g(d, "PdfSha256", "pdfSha256")),
                ts(g(d, "SignedAt", "signedAt")),
                str_or_none(g(d, "SignatureVendor", "signatureVendor")),
                jdump(sig_meta) or "{}",
                str_or_none(g(d, "SignatureAttestationId", "signatureAttestationId")),
                jdump(audit) if audit else "[]",
                ts(g(d, "CreatedAt", "createdAt")),
                ts(g(d, "UpdatedAt", "updatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    if skipped_appt:
        print(
            "  Skipped {} structured_prescriptions (appointment_id not in Postgres appointments)."
            .format(skipped_appt)
        )
        sa = sorted(skipped_appt_ids)
        for sample in sa[:8]:
            print("    orphan appointment_id: {}".format(sample))
        if len(sa) > 8:
            print("    ... and {} other distinct appointment_ids".format(len(sa) - 8))
    if nulled_prescriber:
        print(
            "  Cleared prescriber_user_id on {} rows (user not in Postgres users)."
            .format(nulled_prescriber)
        )
    sql = """
        INSERT INTO structured_prescriptions (
            id, appointment_id, prescriber_user_id, status, template_version,
            draft_payload, signed_payload, pdf_bytes, pdf_bytes_cipher,
            draft_payload_cipher, signed_payload_cipher, pdf_sha256, signed_at,
            signature_vendor, signature_metadata, signature_attestation_id,
            audit_log, created_at, updated_at, deleted
        )
        VALUES (
            %s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s::jsonb,%s,%s,%s
        )
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "structured_prescriptions")
    validate(mongo_db["structuredPrescription"], pg_conn, "structured_prescriptions", "structured_prescriptions")
    if skipped_appt:
        print(
            "  [info] validate may show MISMATCH vs Mongo when prescriptions referenced missing appointments."
        )


# ---------------------------------------------------------------------------
# 6. refresh_tokens  (RefreshTokenEntity — no is_revoked; use deleted + soft policy)
# ---------------------------------------------------------------------------
def migrate_refresh_tokens(mongo_db, pg_conn) -> None:
    valid_users = fetch_pg_user_ids(pg_conn)
    docs = list(mongo_db["refresh_tokens"].find())
    rows = []
    skipped = 0
    skipped_users: Set[str] = set()
    for d in tqdm(docs, desc="refresh_tokens"):
        uid = str_or_none(oid(g(d, "UserId", "userId")))
        if not uid or uid not in valid_users:
            skipped += 1
            if uid:
                skipped_users.add(uid)
            continue
        exp = ts(g(d, "Expiry", "expiresAt", "expires_at"))
        if exp is None:
            created = ts(g(d, "CreatedAt", "createdAt"))
            if created:
                exp = created + timedelta(days=90)
            else:
                exp = datetime.now(timezone.utc)
        rows.append(
            (
                oid(d["_id"]),
                str(g(d, "Token", "token") or ""),
                uid,
                exp,
                str_or_none(g(d, "DeviceId", "deviceId")),
                ts(g(d, "CreatedAt", "createdAt")),
                bool_or(d, "Deleted", "deleted", default=False)
                or bool_or(d, "IsRevoked", "isRevoked", default=False),
            )
        )
    if skipped:
        print(
            "  Skipped {} refresh_tokens (missing/empty user_id or user not in Postgres users)."
            .format(skipped)
        )
        su = sorted(skipped_users)
        for sample in su[:8]:
            print("    orphan user_id: {}".format(sample))
        if len(su) > 8:
            print("    ... and {} other distinct user_ids".format(len(su) - 8))
    sql = """
        INSERT INTO refresh_tokens
            (id, token, user_id, expiry, device_id, created_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "refresh_tokens")
    validate(mongo_db["refresh_tokens"], pg_conn, "refresh_tokens", "refresh_tokens")
    if skipped:
        print(
            "  [info] validate may show MISMATCH vs Mongo count when orphan tokens were skipped."
        )


# ---------------------------------------------------------------------------
# 7. sent_emails  (SentEmailEntity — event + email_body only)
# ---------------------------------------------------------------------------
def migrate_sent_emails(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["sentEmail"].find())
    rows = []
    for d in tqdm(docs, desc="sent_emails"):
        rows.append(
            (
                oid(d["_id"]),
                str_or_none(g(d, "Event", "event", "templateName", "template")),
                str_or_none(g(d, "Email", "email", "emailBody", "email_body")),
                oid(g(d, "PatientId", "patientId")),
                oid(g(d, "DoctorId", "doctorId")),
                ts(g(d, "CreatedTimestamp", "createdAt", "created_at")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO sent_emails
            (id, event, email_body, patient_id, doctor_id, created_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "sent_emails")
    validate(mongo_db["sentEmail"], pg_conn, "sent_emails", "sent_emails")


# ---------------------------------------------------------------------------
# 8. session_telemetry
# ---------------------------------------------------------------------------
def migrate_session_telemetry(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["session_telemetry"].find())
    rows = []
    for d in tqdm(docs, desc="session_telemetry"):
        ev = g(d, "EventCounts", "event_counts", default={}) or {}
        fl = g(d, "FlowCounts", "flow_counts", default={}) or {}
        sm = g(d, "SessionSummary", "session_summary", default=[]) or []
        rows.append(
            (
                oid(d["_id"]),
                str_or_none(g(d, "SessionKey", "sessionKey", "sessionId")),
                str_or_none(g(d, "UserId", "userId")),
                str_or_none(g(d, "TraceId", "traceId")),
                ts(g(d, "StartedAt", "startedAt")),
                ts(g(d, "UpdatedAt", "updatedAt")),
                int_or(d, "TotalEvents", "totalEvents", default=0),
                jdump(ev) or "{}",
                jdump(fl) or "{}",
                str_or_none(g(d, "LastEventName", "lastEventName")),
                str_or_none(g(d, "LastFlow", "lastFlow")),
                str_or_none(g(d, "LastStatus", "lastStatus")),
                str_or_none(g(d, "LastReasonCode", "lastReasonCode")),
                g(d, "LastHttpStatus", "lastHttpStatus", default=None),
                jdump(sm) if sm else "[]",
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO session_telemetry (
            id, session_key, user_id, trace_id, started_at, updated_at,
            total_events, event_counts, flow_counts, last_event_name, last_flow,
            last_status, last_reason_code, last_http_status, session_summary, deleted
        )
        VALUES (
            %s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,%s,%s,%s,%s::jsonb,%s
        )
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "session_telemetry")
    validate(mongo_db["session_telemetry"], pg_conn, "session_telemetry", "session_telemetry")


# ---------------------------------------------------------------------------
# 9. smart_ai_daily_usage  (utc_day, no token_count)
# ---------------------------------------------------------------------------
def migrate_smart_ai_daily_usage(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["smart_ai_daily_usage"].find())
    rows = []
    for d in tqdm(docs, desc="smart_ai_daily_usage"):
        user_id = str_or_none(g(d, "userId", "UserId"))
        utc_day = str_or_none(g(d, "utcDay", "UtcDay", "date"))
        if isinstance(utc_day, str) and "T" in utc_day:
            utc_day = utc_day[:10]
        rid = str_or_none(oid(d.get("_id"))) or (
            (user_id and utc_day) and "{}|{}".format(user_id, utc_day)
        )
        if not rid:
            continue
        rows.append(
            (
                rid,
                int_or(d, "requestCount", "RequestCount", "count", default=0),
                user_id or "",
                utc_day or "unknown",
                ts(g(d, "updatedAt", "UpdatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO smart_ai_daily_usage
            (id, request_count, user_id, utc_day, updated_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "smart_ai_daily_usage")
    validate(mongo_db["smart_ai_daily_usage"], pg_conn, "smart_ai_daily_usage", "smart_ai_daily_usage")


# ---------------------------------------------------------------------------
# 10. ui_metadata  (body_json TEXT — store JSON string, not jsonb column)
# ---------------------------------------------------------------------------
def migrate_ui_metadata(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["uiMetadata"].find())
    rows = []
    for d in tqdm(docs, desc="ui_metadata"):
        doc_id = str_or_none(oid(d.get("_id"))) or "default"
        body = g(d, "bodyJson", "BodyJson")
        if body is None:
            body = json.dumps({k: v for k, v in d.items() if k not in ("_id", "updatedAt", "UpdatedTimestamp")}, default=str)
        elif not isinstance(body, str):
            body = json.dumps(body, default=str)
        rows.append(
            (
                doc_id,
                body,
                ts(g(d, "UpdatedTimestamp", "updatedAt", "updated_at")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO ui_metadata (id, body_json, updated_at, deleted)
        VALUES (%s,%s,%s,%s)
        ON CONFLICT (id) DO UPDATE SET
            body_json   = EXCLUDED.body_json,
            updated_at  = EXCLUDED.updated_at,
            deleted     = EXCLUDED.deleted
    """
    _bulk_execute(pg_conn, sql, rows, "ui_metadata")
    validate(mongo_db["uiMetadata"], pg_conn, "ui_metadata", "ui_metadata")


# ---------------------------------------------------------------------------
# 11. youtube_query_cache  (rag_db.query_cache → PG youtube_query_cache)
# ---------------------------------------------------------------------------
def migrate_youtube_query_cache(rag_db, pg_conn) -> None:
    docs = list(rag_db["query_cache"].find())
    rows = []
    for d in tqdm(docs, desc="youtube_query_cache"):
        uid = str_or_none(
            g(d, "LoggedInUserId", "logged_in_user_id", "UserId", "user_id", "userId")
        ) or ""
        nq = str_or_none(g(d, "Query", "query", "normalized_query", "normalizedQuery")) or ""
        vid = str_or_none(g(d, "VideoId", "video_id", "videoId"))
        title = str_or_none(g(d, "VideoTitle", "video_title", "videoTitle")) or ""
        upd = ts(g(d, "UpdatedAt", "updated_at", "updatedAt")) or datetime.now(timezone.utc)
        rows.append(
            (
                oid(d["_id"]),
                uid,
                nq,
                vid,
                title,
                upd,
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO youtube_query_cache
            (id, user_id, normalized_query, video_id, video_title, updated_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "youtube_query_cache")
    validate(rag_db["query_cache"], pg_conn, "youtube_query_cache", "youtube_query_cache")


# ---------------------------------------------------------------------------
# 12. chat_rooms  (participants TEXT[] — not jsonb)
# ---------------------------------------------------------------------------
def migrate_chat_rooms(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["chat_rooms"].find())
    rows = []
    for d in tqdm(docs, desc="chat_rooms"):
        parts = g(d, "Participants", "participantIds", default=[]) or []
        if not isinstance(parts, list):
            parts = []
        parts_str = [str(p) for p in parts if p is not None]
        rows.append(
            (
                oid(d["_id"]),
                parts_str,
                int_or(d, "NextSequence", "nextSequence", default=0),
                ts(g(d, "CreatedTimestamp", "createdAt")),
                ts(g(d, "UpdatedTimestamp", "updatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO chat_rooms
            (id, participants, next_sequence, created_at, updated_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "chat_rooms")
    validate(mongo_db["chat_rooms"], pg_conn, "chat_rooms", "chat_rooms")


# ---------------------------------------------------------------------------
# 13. chat_messages
# ---------------------------------------------------------------------------
def migrate_chat_messages(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["chat_messages"].find())
    rows = []
    for d in tqdm(docs, desc="chat_messages"):
        rows.append(
            (
                oid(d["_id"]),
                oid(g(d, "RoomId", "roomId")),
                int_or(d, "SequenceNumber", "sequenceNumber", default=0),
                str(g(d, "SenderId", "senderId") or ""),
                str_or_none(g(d, "Body", "body", "content", "message")),
                str_or_none(g(d, "ClientMessageId", "clientMessageId")),
                ts(g(d, "CreatedTimestamp", "createdAt")),
                ts(g(d, "ExpiresAt", "expiresAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO chat_messages
            (id, room_id, sequence_number, sender_id, body, client_message_id,
             created_at, expires_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "chat_messages")
    validate(mongo_db["chat_messages"], pg_conn, "chat_messages", "chat_messages")


# ---------------------------------------------------------------------------
# 14. chat_acks  (up_to_sequence, no message_id / status)
# ---------------------------------------------------------------------------
def migrate_chat_acks(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["chat_acks"].find())
    rows = []
    for d in tqdm(docs, desc="chat_acks"):
        rows.append(
            (
                oid(d["_id"]),
                str(g(d, "RoomId", "roomId") or ""),
                str(g(d, "UserId", "userId") or ""),
                int_or(d, "UpToSequenceNumber", "upToSequence", "up_to_sequence", default=0),
                ts(g(d, "UpdatedTimestamp", "updatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO chat_acks
            (id, room_id, user_id, up_to_sequence, updated_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "chat_acks")
    validate(mongo_db["chat_acks"], pg_conn, "chat_acks", "chat_acks")


# ---------------------------------------------------------------------------
# 15. support_chat_requests  (minimal columns in PG)
# ---------------------------------------------------------------------------
def migrate_support_chat_requests(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["support_chat_requests"].find())
    rows = []
    for d in tqdm(docs, desc="support_chat_requests"):
        st = g(d, "Status", "status", default="OPEN")
        rows.append(
            (
                oid(d["_id"]),
                str(g(d, "RequesterUserId", "requesterUserId", "userId", "user_id") or ""),
                str_or_none(g(d, "AssignedAgentUserId", "assignedAgentUserId", "assignedAgentId")),
                str(st) if st is not None else "OPEN",
                ts(g(d, "CreatedTimestamp", "createdAt")),
                ts(g(d, "UpdatedTimestamp", "updatedAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO support_chat_requests
            (id, requester_user_id, assigned_agent_user_id, status, created_at, updated_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "support_chat_requests")
    validate(mongo_db["support_chat_requests"], pg_conn, "support_chat_requests", "support_chat_requests")


# ---------------------------------------------------------------------------
# 16. call_sessions  (PK call_id; start_time / end_time; no room_id)
# ---------------------------------------------------------------------------
def migrate_call_sessions(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["call_sessions"].find())
    rows = []
    for d in tqdm(docs, desc="call_sessions"):
        cid = str_or_none(g(d, "CallId", "callId")) or str_or_none(oid(d.get("_id")))
        if not cid:
            continue
        st = g(d, "Status", "status", default="RINGING")
        rows.append(
            (
                cid,
                oid(g(d, "InitiatorId", "initiatorId")),
                oid(g(d, "ReceiverId", "receiverId")),
                ts(g(d, "StartTime", "startTime", "startedAt")),
                ts(g(d, "EndTime", "endTime", "endedAt")),
                str(st) if st is not None else "RINGING",
                str_or_none(g(d, "EndedReason", "endedReason")),
                ts(g(d, "ExpiresAt", "expiresAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO call_sessions
            (call_id, initiator_id, receiver_id, start_time, end_time, status, ended_reason, expires_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (call_id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "call_sessions")
    validate(mongo_db["call_sessions"], pg_conn, "call_sessions", "call_sessions")


# ---------------------------------------------------------------------------
# 17. audit_events  (actor_user_id, resource_*; no ip / outcome columns)
# ---------------------------------------------------------------------------
def migrate_audit_events(mongo_db, pg_conn) -> None:
    docs = list(mongo_db["audit_events"].find())
    rows = []
    for d in tqdm(docs, desc="audit_events"):
        meta = g(d, "Metadata", "metadata", "details", default={}) or {}
        rows.append(
            (
                oid(d["_id"]),
                str_or_none(g(d, "ActorUserId", "actorUserId", "userId", "user_id")),
                str_or_none(g(d, "Action", "action", "eventType")),
                str_or_none(g(d, "ResourceType", "resourceType", "entityType")),
                str_or_none(g(d, "ResourceId", "resourceId", "entityId")),
                jdump(meta) or "{}",
                ts(g(d, "CreatedTimestamp", "createdAt", "occurredAt")),
                ts(g(d, "ExpiresAt", "expiresAt")),
                bool_or(d, "Deleted", "deleted", default=False),
            )
        )
    sql = """
        INSERT INTO audit_events
            (id, actor_user_id, action, resource_type, resource_id, metadata, created_at, expires_at, deleted)
        VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s)
        ON CONFLICT (id) DO NOTHING
    """
    _bulk_execute(pg_conn, sql, rows, "audit_events")
    validate(mongo_db["audit_events"], pg_conn, "audit_events", "audit_events")


# ---------------------------------------------------------------------------
# MASTER RUNNER
# ---------------------------------------------------------------------------
def run() -> None:
    if not MONGO_URI or not PG_DSN:
        print("Set MONGO_URI and PG_DSN environment variables.", file=sys.stderr)
        sys.exit(2)

    print("=" * 60)
    print("  MongoDB -> PostgreSQL ETL Migration")
    print("  Started: {}".format(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")))
    print("=" * 60)

    print("\nConnecting to MongoDB...")
    mongo_db = get_mongo(MONGO_URI, MONGO_DB)
    rag_db = get_mongo(MONGO_URI, MONGO_RAG_DB)

    print("Connecting to PostgreSQL...")
    pg_conn = get_pg(PG_DSN)

    stages = [
        ("1.  users", lambda: migrate_users(mongo_db, pg_conn)),
        ("2.  medical_departments", lambda: migrate_medical_departments(mongo_db, pg_conn)),
        ("3.  doctor_schedules", lambda: migrate_doctor_schedules(mongo_db, pg_conn)),
        ("4.  appointments", lambda: migrate_appointments(mongo_db, pg_conn)),
        ("5.  structured_prescriptions", lambda: migrate_structured_prescriptions(mongo_db, pg_conn)),
        ("6.  refresh_tokens", lambda: migrate_refresh_tokens(mongo_db, pg_conn)),
        ("7.  sent_emails", lambda: migrate_sent_emails(mongo_db, pg_conn)),
        ("8.  session_telemetry", lambda: migrate_session_telemetry(mongo_db, pg_conn)),
        ("9.  smart_ai_daily_usage", lambda: migrate_smart_ai_daily_usage(mongo_db, pg_conn)),
        ("10. ui_metadata", lambda: migrate_ui_metadata(mongo_db, pg_conn)),
        ("11. youtube_query_cache", lambda: migrate_youtube_query_cache(rag_db, pg_conn)),
        ("12. chat_rooms", lambda: migrate_chat_rooms(mongo_db, pg_conn)),
        ("13. chat_messages", lambda: migrate_chat_messages(mongo_db, pg_conn)),
        ("14. chat_acks", lambda: migrate_chat_acks(mongo_db, pg_conn)),
        ("15. support_chat_requests", lambda: migrate_support_chat_requests(mongo_db, pg_conn)),
        ("16. call_sessions", lambda: migrate_call_sessions(mongo_db, pg_conn)),
        ("17. audit_events", lambda: migrate_audit_events(mongo_db, pg_conn)),
    ]

    failed = []
    for label, fn in stages:
        print("\n--- Stage {} ---".format(label))
        try:
            fn()
        except Exception as e:
            pg_conn.rollback()
            print("  FAILED: {}".format(e))
            traceback.print_exc()
            failed.append(label)

    print("\n" + "=" * 60)
    if failed:
        print("  Migration completed WITH ERRORS in: {}".format(failed))
        sys.exit(1)
    print("  Migration completed successfully!")
    print("  Finished: {}".format(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")))
    print("=" * 60)

    pg_conn.close()


if __name__ == "__main__":
    run()
