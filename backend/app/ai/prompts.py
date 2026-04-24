from __future__ import annotations

import json
from typing import Any, Mapping, Sequence


D1_CRITERIA: dict[str, int] = {
    "Research depth": 25,
    "Source quality": 20,
    "Motivation clarity": 30,
    "Writing structure": 25,
}

D2_CRITERIA: dict[str, int] = {
    "REQ format correctness": 20,
    "No ambiguity": 25,
    "Completeness": 30,
    "Traceability to D1": 25,
}

D3_CRITERIA: dict[str, int] = {
    "Question quality": 35,
    "Coverage of new use cases": 35,
    "Variety and depth": 30,
}

D4_CRITERIA: dict[str, int] = {
    "Integration of D3 findings": 40,
    "Consistency with D1+D2": 30,
    "Document maturity": 30,
}


def _format_previous_submissions(
    previous_submissions: Sequence[Mapping[str, Any] | str],
) -> str:
    if not previous_submissions:
        return "No previous submissions are available for this student and project."

    blocks: list[str] = []

    for index, item in enumerate(previous_submissions, start=1):
        if isinstance(item, str):
            blocks.append(f"Previous submission {index}:\n{item.strip()}")
            continue

        deliverable_number = item.get("deliverable_number", index)
        content = str(item.get("content", "")).strip()
        score = item.get("score")
        feedback = str(item.get("feedback", "")).strip()

        meta = f"Previous submission D{deliverable_number}"
        if score is not None:
            meta += f" | Previous score: {score}"

        if feedback:
            blocks.append(
                f"{meta}:\n"
                f"CONTENT:\n{content}\n\n"
                f"PREVIOUS FEEDBACK:\n{feedback}"
            )
        else:
            blocks.append(f"{meta}:\nCONTENT:\n{content}")

    return "\n\n---\n\n".join(blocks)


def _criteria_description(criteria: Mapping[str, int]) -> str:
    return "\n".join(
        f"- {name}: 0-{max_points} points"
        for name, max_points in criteria.items()
    )


def _json_contract(criteria: Mapping[str, int]) -> str:
    example = {
        "score": 0,
        "criteria": {name: 0 for name in criteria.keys()},
        "feedback": "Detailed constructive feedback of at least 150 words.",
    }
    return json.dumps(example, indent=2, ensure_ascii=False)


def _base_rules(criteria: Mapping[str, int]) -> str:
    return f"""
General grading rules:
- You are an expert Software Engineering professor grading a Requirements Engineering assignment.
- Be strict, fair, specific, and evidence-based.
- Grade only what the student submitted. Do not reward claims that are not supported by the text.
- Do not infer missing work. Penalize missing evidence, missing traceability, vague wording, and generic content.
- Criterion scores are raw points, not percentages.
- The total score must be the sum of the criterion scores and must be between 0 and 100.
- Use these exact criterion names and maximum points:
{_criteria_description(criteria)}
- Calibrate scores strictly:
  - 90-100: excellent, specific, complete, well-supported, and clearly aligned with the rubric.
  - 70-89: good, mostly complete, with only minor weaknesses.
  - 50-69: acceptable but incomplete, vague, weakly supported, or partially aligned.
  - 30-49: poor, superficial, ambiguous, or missing important parts.
  - 0-29: mostly missing, irrelevant, or unusable.
- Feedback must be at least 150 words.
- Feedback must mention concrete strengths, concrete weaknesses, and specific improvement actions.
- Feedback must explicitly mention why the score is not higher.
- Feedback must cite concrete elements from the student's submission.
- If previous submissions are provided, use them as context and reference them when relevant.
- Write the feedback as clean prose with proper paragraph spacing and punctuation.
- Do not include Markdown fences. Do not include explanations outside the JSON.

Required JSON structure:
{_json_contract(criteria)}

Final hard requirement:
Respond ONLY with valid JSON: {{score: int 0-100, criteria: {{name: score}}, feedback: string min 150 words}}
""".strip()


def build_deliverable_1_prompt(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str],
) -> str:
    return f"""
Task: Evaluate Deliverable 1 — Research + Motivation Letter.

Project topic:
{project_topic}

Previous submissions for this student/project:
{_format_previous_submissions(previous_submissions)}

Current deliverable content:
{deliverable_content}

Specific rubric for Deliverable 1:
- Research depth: assess whether the student understands the domain, users, problem, constraints, and context.
- Source quality: assess credibility, relevance, specificity, and use of sources. Penalize missing, vague, or low-quality sources.
- Motivation clarity: assess whether the student explains a clear personal/academic/professional motivation linked to the project.
- Writing structure: assess organization, clarity, coherence, transitions, and readability.

{_base_rules(D1_CRITERIA)}
""".strip()


def build_deliverable_2_prompt(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str],
) -> str:
    return f"""
Task: Evaluate Deliverable 2 — User Requirements List.

Project topic:
{project_topic}

Previous submissions for this student/project:
{_format_previous_submissions(previous_submissions)}

Current deliverable content:
{deliverable_content}

Specific rubric for Deliverable 2:
- REQ format correctness: assess whether requirements are written in a clear requirement format, preferably identifiable IDs and user/system-oriented statements.
- No ambiguity: assess whether requirements avoid vague terms, unclear actors, hidden assumptions, and unverifiable wording.
- Completeness: assess coverage of major functional and relevant non-functional requirements for the chosen topic.
- Traceability to D1: assess whether the requirements logically derive from the research, problem context, users, and motivation in Deliverable 1.

{_base_rules(D2_CRITERIA)}
""".strip()


def build_deliverable_3_prompt(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str],
) -> str:
    return f"""
Task: Evaluate Deliverable 3 — Target Group Interview Questions.

Project topic:
{project_topic}

Previous submissions for this student/project:
{_format_previous_submissions(previous_submissions)}

Current deliverable content:
{deliverable_content}

Specific rubric for Deliverable 3:
- Question quality: assess whether questions are clear, neutral, open enough, relevant to users, and useful for requirements elicitation.
- Coverage of new use cases: assess whether questions explore unknown needs, edge cases, workflows, pain points, constraints, and scenarios not already covered in previous deliverables.
- Variety and depth: assess whether the set includes different types of questions and goes beyond superficial yes/no validation.

{_base_rules(D3_CRITERIA)}
""".strip()


def build_deliverable_4_prompt(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str],
) -> str:
    return f"""
Task: Evaluate Deliverable 4 — Updated Requirements List.

Project topic:
{project_topic}

Previous submissions for this student/project:
{_format_previous_submissions(previous_submissions)}

Current deliverable content:
{deliverable_content}

Specific rubric for Deliverable 4:
- Integration of D3 findings: assess whether new or refined requirements clearly derive from the interview/question phase and are not merely copied from D2.
- Consistency with D1+D2: assess whether the updated requirements remain coherent with the original research, project motivation, and first requirement list.
- Document maturity: assess completeness, organization, prioritization, clarity, traceability, and readiness as a final requirements document.

Strict grading rules for Deliverable 4:
- This deliverable must be an updated and mature requirements document, not just a short list of generic requirements.
- If the submission does not clearly integrate findings, questions, or insights from Deliverable 3, the score for "Integration of D3 findings" must be 10/40 or lower.
- If the submission does not reference, preserve, or logically extend the requirements from Deliverable 2, the score for "Consistency with D1+D2" must be 15/30 or lower.
- If the submission contains only a few vague requirements, lacks IDs, lacks structure, lacks non-functional requirements, or is not ready as a final document, the score for "Document maturity" must be 15/30 or lower.
- A submission with only 3-5 short generic requirements must not receive more than 50/100.
- A high score requires explicit evidence that new requirements were derived from D3 interview/question insights.
- When previous Deliverable 3 content is available, explicitly reference at least two concrete questions, topics, or findings from D3 and explain whether they were integrated into the updated requirements.

{_base_rules(D4_CRITERIA)}
""".strip()


PROMPT_BUILDERS = {
    1: build_deliverable_1_prompt,
    2: build_deliverable_2_prompt,
    3: build_deliverable_3_prompt,
    4: build_deliverable_4_prompt,
}

CRITERIA_BY_DELIVERABLE = {
    1: D1_CRITERIA,
    2: D2_CRITERIA,
    3: D3_CRITERIA,
    4: D4_CRITERIA,
}