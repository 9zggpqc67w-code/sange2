AI APPLICANT COPILOT - DEMO APPLICANT PACKAGE
================================================

Fictional applicant: Arjun Mehta
Goal: Master's degree in Computer Science in Germany

Files:
01_Arjun_Mehta_CV.pdf
02_Arjun_Mehta_Degree_Certificate.pdf
03_Arjun_Mehta_Academic_Transcript.pdf
04_Arjun_Mehta_Language_Certificate.pdf
05_Arjun_Mehta_Experience_Letter.pdf
06_Arjun_Mehta_Statement_of_Purpose.pdf
07_Arjun_Mehta_Demo_Profile_and_Rules.pdf

Purpose:
Use these documents to test document extraction, normalization, evidence
tagging, missing/conflict detection, qualification rules, readiness scoring,
and agent next-action reasoning.

IMPORTANT:
All applicant details and documents are fictional and created only for
hackathon demonstration/testing. They are not official academic, language,
employment, immigration, or government documents.

Suggested complete-state test:
- All documents uploaded
- Degree + transcript confirm graduation year 2025
- Language overall score 7.0
- 8 months experience
- No conflicts

Suggested agent test:
1. First omit the language certificate -> agent should identify missing evidence.
2. Upload the language certificate -> state should update.
3. Then modify one data source (e.g. CV graduation year = 2024) -> system should flag CONFLICT, not silently pick a value.
4. Resolve the conflict -> re-run qualification/agent and verify the next action changes.
