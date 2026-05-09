export const DELIVERABLES = [
  {
    number: 1,
    name: "Research + Motivation Letter",
    shortName: "Research letter",
    description:
      "Research the project topic, justify the motivation, and explain why the problem matters.",
    lockedReason: "Start with Deliverable 1.",
    criteria: [
      { name: "Research depth", maxPoints: 25 },
      { name: "Source quality", maxPoints: 20 },
      { name: "Motivation clarity", maxPoints: 30 },
      { name: "Writing structure", maxPoints: 25 },
    ],
  },
  {
    number: 2,
    name: "User Requirements List",
    shortName: "User requirements",
    description:
      "Write clear, complete, unambiguous user requirements connected to your research.",
    lockedReason: "Submit and receive feedback for Deliverable 1 first.",
    criteria: [
      { name: "REQ format correctness", maxPoints: 20 },
      { name: "No ambiguity", maxPoints: 25 },
      { name: "Completeness", maxPoints: 30 },
      { name: "Traceability to D1", maxPoints: 25 },
    ],
  },
  {
    number: 3,
    name: "Target Group Interview Questions",
    shortName: "Interview questions",
    description:
      "Prepare questions aimed at discovering new requirements and uncovered use cases.",
    lockedReason: "Submit and receive feedback for Deliverable 2 first.",
    criteria: [
      { name: "Question quality", maxPoints: 35 },
      { name: "Coverage of new use cases", maxPoints: 35 },
      { name: "Variety and depth", maxPoints: 30 },
    ],
  },
  {
    number: 4,
    name: "Updated Requirements List",
    shortName: "Final requirements",
    description:
      "Integrate new findings and produce a mature, coherent final requirements document.",
    lockedReason: "Submit and receive feedback for Deliverable 3 first.",
    criteria: [
      { name: "Integration of D3 findings", maxPoints: 40 },
      { name: "Consistency with D1+D2", maxPoints: 30 },
      { name: "Document maturity", maxPoints: 30 },
    ],
  },
];

export function normalizeCriterionName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getDeliverableByNumber(deliverableNumber) {
  return DELIVERABLES.find(
    (deliverable) => deliverable.number === Number(deliverableNumber)
  );
}

export function getCriteriaForDeliverable(deliverableNumber) {
  const deliverable = getDeliverableByNumber(deliverableNumber);
  return deliverable?.criteria || [];
}

export function getCriterionMaxPoints(criterionName, deliverableNumber = null) {
  const normalizedCriterionName = normalizeCriterionName(criterionName);

  if (deliverableNumber !== null && deliverableNumber !== undefined) {
    const deliverable = getDeliverableByNumber(deliverableNumber);

    const criterion = deliverable?.criteria?.find(
      (item) => normalizeCriterionName(item.name) === normalizedCriterionName
    );

    return criterion?.maxPoints ?? 100;
  }

  for (const deliverable of DELIVERABLES) {
    const criterion = deliverable.criteria.find(
      (item) => normalizeCriterionName(item.name) === normalizedCriterionName
    );

    if (criterion) {
      return criterion.maxPoints;
    }
  }

  return 100;
}

export function inferDeliverableNumberFromCriteria(criteriaInput) {
  if (!criteriaInput) {
    return null;
  }

  let criterionNames = [];

  if (Array.isArray(criteriaInput)) {
    criterionNames = criteriaInput
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return item?.name;
      })
      .filter(Boolean);
  } else if (typeof criteriaInput === "object") {
    criterionNames = Object.keys(criteriaInput);
  }

  if (criterionNames.length === 0) {
    return null;
  }

  const normalizedInputNames = criterionNames.map(normalizeCriterionName);

  let bestMatch = {
    deliverableNumber: null,
    matches: 0,
  };

  for (const deliverable of DELIVERABLES) {
    const normalizedDeliverableCriteria = deliverable.criteria.map((criterion) =>
      normalizeCriterionName(criterion.name)
    );

    const matches = normalizedInputNames.filter((name) =>
      normalizedDeliverableCriteria.includes(name)
    ).length;

    if (matches > bestMatch.matches) {
      bestMatch = {
        deliverableNumber: deliverable.number,
        matches,
      };
    }
  }

  return bestMatch.matches > 0 ? bestMatch.deliverableNumber : null;
}

export function getCriterionPercentage(
  criterionName,
  score,
  deliverableNumber = null
) {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return 0;
  }

  const resolvedDeliverableNumber =
    deliverableNumber !== null && deliverableNumber !== undefined
      ? deliverableNumber
      : null;

  const maxPoints = getCriterionMaxPoints(
    criterionName,
    resolvedDeliverableNumber
  );

  if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
    return 0;
  }

  const percentage = (numericScore / maxPoints) * 100;

  return Math.max(0, Math.min(100, percentage));
}

export function formatCriterionScore(
  criterionName,
  score,
  deliverableNumber = null
) {
  const numericScore = Number(score);
  const maxPoints = getCriterionMaxPoints(criterionName, deliverableNumber);

  if (!Number.isFinite(numericScore)) {
    return `—/${maxPoints}`;
  }

  return `${numericScore}/${maxPoints}`;
}

// Compatibility aliases, por si algún componente usa otros nombres.
export const getCriterionMaxScore = getCriterionMaxPoints;
export const getCriterionProgressPercentage = getCriterionPercentage;