/** CMS national dataset sources for health plan catalog ingestion. */
export const CMS_DATA_SOURCES = {
  cpsc: {
    id: "cms-cpsc-monthly",
    label: "CMS Medicare Advantage / Part D — Monthly Enrollment by Contract",
    url: "https://www.cms.gov/files/zip/monthly-enrollment-contract-december-2025.zip",
    refreshCadence: "monthly",
  },
  qhpPlanAttributes: {
    id: "cms-qhp-plan-attributes",
    label: "CMS Exchange Plan Attributes PUF",
    url: "https://data.healthcare.gov/datafile/py2025/Plan_Attributes_PUF.csv",
    refreshCadence: "annual",
  },
  qhpServiceArea: {
    id: "cms-qhp-service-area",
    label: "CMS Exchange Service Area PUF",
    url: "https://data.healthcare.gov/datafile/py2025/Service_Area_PUF.csv",
    refreshCadence: "annual",
  },
  medicaidMco: {
    id: "cms-medicaid-managed-care-programs",
    label: "Medicaid Managed Care Programs by State",
    url: "https://data.medicaid.gov/api/1/datastore/query/ef16c490-861a-4b1f-9e6d-f321abdcaab1/0",
    refreshCadence: "annual",
  },
  medicaidEnrollment: {
    id: "cms-medicaid-enrollment-by-plan",
    label: "Medicaid Managed Care Enrollment by Program and Plan",
    url: "https://data.medicaid.gov/api/1/datastore/query/0bef7b8a-c663-5b14-9a46-0b5c2b86b0fe/0",
    refreshCadence: "annual",
  },
} as const;

export type CmsDataSourceId = keyof typeof CMS_DATA_SOURCES;
