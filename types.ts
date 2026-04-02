
export interface BugReport {
  summary: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
}

export interface BDDScenario {
  feature: string;
  scenario: string;
  steps: {
    keyword: 'Given' | 'When' | 'Then' | 'And';
    text: string;
  }[];
}

export type ViewState = 'generator' | 'bdd';
