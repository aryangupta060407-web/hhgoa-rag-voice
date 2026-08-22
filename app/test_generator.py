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


def test_refuses_when_a_sentence_omits_a_required_subject_anchor():
    answer = generate_answer(
        "What is that cluster of stars near Taurus?",
        [Context("In 1054 a massive star near the tip of the horn of Taurus exploded.")],
    )
    assert answer.grounded is False
    assert answer.text == REFUSAL


def test_refuses_when_context_only_matches_part_of_a_multi_subject_question():
    answer = generate_answer(
        "How is cultural transmission theory related to the concentric zone hypothesis?",
        [Context("Criminal Justice includes a cultural transmission theory category.")],
    )
    assert answer.grounded is False
    assert answer.text == REFUSAL


def test_extracts_when_all_specific_subject_anchors_are_present():
    answer = generate_answer(
        "What is the Burgher Republic definition?",
        [Context("A Burgher Republic is a political state governed by its enfranchised citizens.")],
    )
    assert answer.grounded is True
    assert answer.text == "A Burgher Republic is a political state governed by its enfranchised citizens."


if __name__ == "__main__":
    test_extracts_evidence_with_subject_anchor()
    test_refuses_generic_overlap_without_subject_anchor()
    test_refuses_when_a_sentence_omits_a_required_subject_anchor()
    test_refuses_when_context_only_matches_part_of_a_multi_subject_question()
    test_extracts_when_all_specific_subject_anchors_are_present()
    print("Evaluation adapter generator checks passed.")
