import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: [
    "<rootDir>/tests/**/*.test.ts",
    "<rootDir>/tests/**/*.test.tsx",
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/src/**/*.test.tsx",
  ],
  collectCoverageFrom: [
    "src/server/**/*.ts",
    "!src/**/*.d.ts",
  ],
  passWithNoTests: true,
};

export default config;
