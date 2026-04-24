import json
import sys
from pathlib import Path

# Add /backend to Python import path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.ai.evaluator import evaluate_deliverable_1


def main() -> None:
    result = evaluate_deliverable_1(
        project_topic="AI-powered web platform for automatic grading of Software Engineering deliverables",
        deliverable_content="""
        This project aims to solve the problem of delayed feedback in Software Engineering courses.
        Students often submit requirements engineering documents and wait several days or weeks before receiving
        comments from professors. This delay reduces the usefulness of the feedback because students cannot quickly
        improve their next deliverable.

        The proposed platform uses an AI agent to evaluate four sequential deliverables: research and motivation,
        user requirements, target group questions, and an updated requirements document. The system gives students
        immediate feedback and helps professors supervise progress more efficiently.

        The motivation for this project is both academic and practical. From an academic perspective, it demonstrates
        how LLMs can be integrated into a real software workflow. From a practical perspective, it reduces repetitive
        grading work and improves learning speed. Sources considered include university assessment practices,
        requirements engineering guidelines, and documentation about LLM-based feedback systems.
        """,
        previous_submissions=[],
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()