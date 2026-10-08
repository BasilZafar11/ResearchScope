export const reportViews=['overview','evidence','claims','study','review','record'] as const;
export type ReportView=typeof reportViews[number];
export type ResearchTool={id:string;group:'toolkit'|'defense'|'integrity';number:number;title:string;view:ReportView};
export const researchTools:ResearchTool[]=[
  {
    "id": "toolkit-1",
    "group": "toolkit",
    "number": 1,
    "title": "Compare several project ideas",
    "view": "claims"
  },
  {
    "id": "toolkit-2",
    "group": "toolkit",
    "number": 2,
    "title": "Check project feasibility",
    "view": "study"
  },
  {
    "id": "toolkit-3",
    "group": "toolkit",
    "number": 3,
    "title": "Find datasets",
    "view": "study"
  },
  {
    "id": "toolkit-4",
    "group": "toolkit",
    "number": 4,
    "title": "Find code and implementations",
    "view": "study"
  },
  {
    "id": "toolkit-5",
    "group": "toolkit",
    "number": 5,
    "title": "Explore citation trails",
    "view": "evidence"
  },
  {
    "id": "toolkit-6",
    "group": "toolkit",
    "number": 6,
    "title": "Search for contradictory results",
    "view": "evidence"
  },
  {
    "id": "toolkit-7",
    "group": "toolkit",
    "number": 7,
    "title": "Check corrections and retractions",
    "view": "evidence"
  },
  {
    "id": "toolkit-8",
    "group": "toolkit",
    "number": 8,
    "title": "Assess study quality",
    "view": "evidence"
  },
  {
    "id": "toolkit-9",
    "group": "toolkit",
    "number": 9,
    "title": "Expand terminology",
    "view": "evidence"
  },
  {
    "id": "toolkit-10",
    "group": "toolkit",
    "number": 10,
    "title": "Search in another language",
    "view": "evidence"
  },
  {
    "id": "toolkit-11",
    "group": "toolkit",
    "number": 11,
    "title": "Find methods from neighboring fields",
    "view": "study"
  },
  {
    "id": "toolkit-12",
    "group": "toolkit",
    "number": 12,
    "title": "Shape a research question",
    "view": "claims"
  },
  {
    "id": "toolkit-13",
    "group": "toolkit",
    "number": 13,
    "title": "Check search sensitivity",
    "view": "record"
  },
  {
    "id": "toolkit-14",
    "group": "toolkit",
    "number": 14,
    "title": "Verify citation details",
    "view": "evidence"
  },
  {
    "id": "toolkit-15",
    "group": "toolkit",
    "number": 15,
    "title": "Export references",
    "view": "record"
  },
  {
    "id": "toolkit-16",
    "group": "toolkit",
    "number": 16,
    "title": "Screen retrieved records",
    "view": "evidence"
  },
  {
    "id": "toolkit-17",
    "group": "toolkit",
    "number": 17,
    "title": "Build a reading queue",
    "view": "evidence"
  },
  {
    "id": "toolkit-18",
    "group": "toolkit",
    "number": 18,
    "title": "Reproducibility checklist",
    "view": "study"
  },
  {
    "id": "toolkit-19",
    "group": "toolkit",
    "number": 19,
    "title": "Keep a research decision journal",
    "view": "review"
  },
  {
    "id": "toolkit-20",
    "group": "toolkit",
    "number": 20,
    "title": "Private local research mode",
    "view": "record"
  },
  {
    "id": "defense-1",
    "group": "defense",
    "number": 1,
    "title": "Combination overlap audit",
    "view": "claims"
  },
  {
    "id": "defense-2",
    "group": "defense",
    "number": 2,
    "title": "Novelty wording checker",
    "view": "claims"
  },
  {
    "id": "defense-3",
    "group": "defense",
    "number": 3,
    "title": "Claim boundary editor",
    "view": "claims"
  },
  {
    "id": "defense-4",
    "group": "defense",
    "number": 4,
    "title": "Baseline fairness audit",
    "view": "study"
  },
  {
    "id": "defense-5",
    "group": "defense",
    "number": 5,
    "title": "Outdated baseline detector",
    "view": "study"
  },
  {
    "id": "defense-6",
    "group": "defense",
    "number": 6,
    "title": "Dataset leakage audit",
    "view": "study"
  },
  {
    "id": "defense-7",
    "group": "defense",
    "number": 7,
    "title": "Benchmark contamination check",
    "view": "study"
  },
  {
    "id": "defense-8",
    "group": "defense",
    "number": 8,
    "title": "Hidden prior-work discovery",
    "view": "evidence"
  },
  {
    "id": "defense-9",
    "group": "defense",
    "number": 9,
    "title": "Publication lineage view",
    "view": "evidence"
  },
  {
    "id": "defense-10",
    "group": "defense",
    "number": 10,
    "title": "Evidence cutoff snapshot",
    "view": "record"
  },
  {
    "id": "defense-11",
    "group": "defense",
    "number": 11,
    "title": "Full-text access finder",
    "view": "evidence"
  },
  {
    "id": "defense-12",
    "group": "defense",
    "number": 12,
    "title": "Search stopping assistant",
    "view": "evidence"
  },
  {
    "id": "defense-13",
    "group": "defense",
    "number": 13,
    "title": "Contribution importance assessment",
    "view": "claims"
  },
  {
    "id": "defense-14",
    "group": "defense",
    "number": 14,
    "title": "Claim-to-measurement alignment",
    "view": "study"
  },
  {
    "id": "defense-15",
    "group": "defense",
    "number": 15,
    "title": "Confounder finder",
    "view": "study"
  },
  {
    "id": "defense-16",
    "group": "defense",
    "number": 16,
    "title": "Minimum convincing study planner",
    "view": "study"
  },
  {
    "id": "defense-17",
    "group": "defense",
    "number": 17,
    "title": "Failure knowledge notebook",
    "view": "review"
  },
  {
    "id": "defense-18",
    "group": "defense",
    "number": 18,
    "title": "Venue criteria mapper",
    "view": "review"
  },
  {
    "id": "defense-19",
    "group": "defense",
    "number": 19,
    "title": "Research task ownership board",
    "view": "review"
  },
  {
    "id": "defense-20",
    "group": "defense",
    "number": 20,
    "title": "Proceed, revise, or pause gate",
    "view": "review"
  },
  {
    "id": "integrity-1",
    "group": "integrity",
    "number": 1,
    "title": "Retraction and correction alerts",
    "view": "evidence"
  },
  {
    "id": "integrity-2",
    "group": "integrity",
    "number": 2,
    "title": "Contradictory evidence explorer",
    "view": "evidence"
  },
  {
    "id": "integrity-3",
    "group": "integrity",
    "number": 3,
    "title": "Citation support checker",
    "view": "claims"
  },
  {
    "id": "integrity-4",
    "group": "integrity",
    "number": 4,
    "title": "Research question precision coach",
    "view": "claims"
  },
  {
    "id": "integrity-5",
    "group": "integrity",
    "number": 5,
    "title": "Statistical power and precision planner",
    "view": "study"
  },
  {
    "id": "integrity-6",
    "group": "integrity",
    "number": 6,
    "title": "Reproducibility package builder",
    "view": "record"
  },
  {
    "id": "integrity-7",
    "group": "integrity",
    "number": 7,
    "title": "Research artifact availability audit",
    "view": "evidence"
  },
  {
    "id": "integrity-8",
    "group": "integrity",
    "number": 8,
    "title": "Evidence extraction reconciliation",
    "view": "review"
  },
  {
    "id": "integrity-9",
    "group": "integrity",
    "number": 9,
    "title": "Multilingual prior-work discovery",
    "view": "evidence"
  },
  {
    "id": "integrity-10",
    "group": "integrity",
    "number": 10,
    "title": "Sensitive-data research readiness",
    "view": "study"
  }
];
export function reportView(value:string|null):ReportView{return reportViews.includes(value as ReportView)?value as ReportView:'overview';}
