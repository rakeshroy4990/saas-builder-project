import {
  buildEducationAttachmentDisplayContent,
  buildEducationRetrievalQuestionWithAttachments,
  stripEducationAttachedFileHeaders
} from '@/features/education/educationClinicalAttachments';

describe('educationClinicalAttachments', () => {
  const rows = [
    { id: '1', name: '30.jpeg', retrievalText: 'Diagnosis:\nFever' },
    { id: '2', name: '30_1.jpeg', retrievalText: 'Diagnosis:\nDengue IgM weakly positive' }
  ];

  it('builds retrieval with file names', () => {
    const q = 'Analyze files';
    expect(buildEducationRetrievalQuestionWithAttachments(q, rows)).toContain('[Attached file: 30.jpeg]');
    expect(buildEducationRetrievalQuestionWithAttachments(q, rows)).toContain('Clinical context from attached files');
  });

  it('builds display without file names', () => {
    const auto = 'Please analyze the attached clinical files';
    const display = buildEducationAttachmentDisplayContent(auto, rows, { autoQuestion: auto });
    expect(display).not.toContain('[Attached file:');
    expect(display).toContain('Fever');
    expect(display).toContain('Dengue IgM');
  });

  it('strips legacy file headers from bubble text', () => {
    const raw = '[Attached file: 30.jpeg]\nDiagnosis:\nFever';
    expect(stripEducationAttachedFileHeaders(raw)).toBe('Diagnosis:\nFever');
  });
});
