import { describe, expect, it } from "vitest";

import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";

const CANONICAL_LOCATION_MEMBERS = Object.freeze([
  "HA_NOI",
  "HA_GIANG",
  "CAO_BANG",
  "BAC_KAN",
  "TUYEN_QUANG",
  "LAO_CAI",
  "DIEN_BIEN",
  "LAI_CHAU",
  "SON_LA",
  "YEN_BAI",
  "HOA_BINH",
  "THAI_NGUYEN",
  "LANG_SON",
  "QUANG_NINH",
  "BAC_GIANG",
  "PHU_THO",
  "VINH_PHUC",
  "BAC_NINH",
  "HAI_DUONG",
  "HAI_PHONG",
  "HUNG_YEN",
  "THAI_BINH",
  "HA_NAM",
  "NAM_DINH",
  "NINH_BINH",
  "THANH_HOA",
  "NGHE_AN",
  "HA_TINH",
  "QUANG_BINH",
  "QUANG_TRI",
  "HUE",
  "DA_NANG",
  "QUANG_NAM",
  "QUANG_NGAI",
  "BINH_DINH",
  "PHU_YEN",
  "KHANH_HOA",
  "NINH_THUAN",
  "BINH_THUAN",
  "KON_TUM",
  "GIA_LAI",
  "DAK_LAK",
  "DAK_NONG",
  "LAM_DONG",
  "BINH_PHUOC",
  "TAY_NINH",
  "BINH_DUONG",
  "DONG_NAI",
  "BA_RIA_VUNG_TAU",
  "HO_CHI_MINH",
  "LONG_AN",
  "TIEN_GIANG",
  "BEN_TRE",
  "TRA_VINH",
  "VINH_LONG",
  "DONG_THAP",
  "AN_GIANG",
  "KIEN_GIANG",
  "CAN_THO",
  "HAU_GIANG",
  "SOC_TRANG",
  "BAC_LIEU",
  "CA_MAU",
  "FOREIGN",
]);

const CANONICAL_EMPLOYMENT_TYPE_MEMBERS = Object.freeze([
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "TEMPORARY",
  "FREELANCE",
  "SEASONAL",
  "APPRENTICESHIP",
]);

const CANONICAL_WORK_MODE_MEMBERS = Object.freeze([
  "ONSITE",
  "HYBRID",
  "REMOTE",
]);

const assertExactClosedVocabulary = (vocabulary, expectedMembers) => {
  expect(Object.isFrozen(vocabulary)).toBe(true);

  const values = Object.values(vocabulary);
  const keys = Object.keys(vocabulary);

  expect(values).toEqual([...expectedMembers]);
  expect(keys).toEqual([...expectedMembers]);
  expect(new Set(values).size).toBe(expectedMembers.length);
  expect(values).toHaveLength(expectedMembers.length);

  for (const member of expectedMembers) {
    expect(vocabulary[member]).toBe(member);
  }
};

describe("V4 Slice 01 — fixed platform vocabularies (F03, F04, F05)", () => {
  it("provides Location as the locked 64-member canonical snapshot plus FOREIGN", () => {
    assertExactClosedVocabulary(LOCATION, CANONICAL_LOCATION_MEMBERS);
    expect(CANONICAL_LOCATION_MEMBERS).toHaveLength(64);
    expect(LOCATION.FOREIGN).toBe("FOREIGN");
  });

  it("does not treat REMOTE as a Location member", () => {
    expect(Object.values(LOCATION)).not.toContain("REMOTE");
    expect(LOCATION.REMOTE).toBeUndefined();
  });

  it("provides EmploymentType as the locked 8-member closed set", () => {
    assertExactClosedVocabulary(
      EMPLOYMENT_TYPE,
      CANONICAL_EMPLOYMENT_TYPE_MEMBERS,
    );
  });

  it("provides WorkMode as the locked 3-member closed set including REMOTE", () => {
    assertExactClosedVocabulary(WORK_MODE, CANONICAL_WORK_MODE_MEMBERS);
    expect(WORK_MODE.REMOTE).toBe("REMOTE");
  });

  it("keeps Location and WorkMode as independent closed vocabularies", () => {
    const locationMembers = new Set(Object.values(LOCATION));
    const workModeMembers = new Set(Object.values(WORK_MODE));

    expect(locationMembers.has("REMOTE")).toBe(false);
    expect(workModeMembers.has("REMOTE")).toBe(true);
    expect(
      [...locationMembers].filter((member) => workModeMembers.has(member)),
    ).toEqual([]);
  });
});
