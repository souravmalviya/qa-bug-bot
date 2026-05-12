export const OPENROUTER_MODEL = 'openai/gpt-5.2';
export const MAX_INPUT_LENGTH = 5000;

export const BUG_REPORT_SCHEMA = {
  name: 'bug_report',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' },
      stepsToReproduce: { type: 'array', items: { type: 'string' } },
      expectedResult: { type: 'string' },
      actualResult: { type: 'string' },
      severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
      category: { type: 'string' },
    },
    required: ['summary', 'stepsToReproduce', 'expectedResult', 'actualResult', 'severity', 'category'],
    additionalProperties: false,
  },
};

export const BDD_SCENARIO_SCHEMA = {
  name: 'bdd_scenario',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      feature: { type: 'string', description: 'The high-level feature name.' },
      scenario: { type: 'string', description: 'The specific scenario being tested.' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            keyword: { type: 'string', enum: ['Given', 'When', 'Then', 'And'] },
            text: { type: 'string' },
          },
          required: ['keyword', 'text'],
          additionalProperties: false,
        },
      },
    },
    required: ['feature', 'scenario', 'steps'],
    additionalProperties: false,
  },
};
