from query.safety_layer import check_safety


def test_blocks_harmful_query():
    result = check_safety("how to harm myself")
    assert result.safe is False


def test_escalates_emergency_phrase():
    result = check_safety("I have chest pain and cannot sleep")
    assert result.safe is True
    assert result.escalate is True
