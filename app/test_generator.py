from app.generator import REFUSAL, generate_answer


class Context:
    def __init__(self, text: str):
        self.text = text
        self.source = "test"


def test_extracts_evidence_with_subject_anchor():
    answer = generate_answer("What is a corporation?", [Context("A corporation is a legal business entity.")])
    assert answer.grounded is True
    assert answer.text == "A corporation is a legal business entity."


def test_refuses_generic_overlap_without_subject_anchor():
    answer = generate_answer("How fast does an eagle travel?", [Context("The video playback is too fast and unwatchable.")])
    assert answer.grounded is False
    assert answer.text == REFUSAL


if __name__ == "__main__":
    test_extracts_evidence_with_subject_anchor()
    test_refuses_generic_overlap_without_subject_anchor()
    print("Evaluation adapter generator checks passed.")
