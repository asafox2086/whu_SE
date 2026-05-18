import test from "node:test";
import assert from "node:assert/strict";

import {
  applyToResearchProject,
  createTeamRecruit,
  createInitialState,
  getCompetitionDetail,
  listCertificateRecords,
  listCertificateCollection,
  listResearchApplicationsForMentor,
  listOpportunities,
  login,
  listFeedbackEntries,
  recordUsage,
  registerUser,
  registerStudent,
  submitFeedback,
  uploadCertificateRecord
} from "../src/domain.mjs";

test("student can register and then log in", () => {
  const registered = registerStudent(createInitialState(), {
    name: "陈星",
    email: "chenxing@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程",
    githubUrl: "https://github.com/chenxing"
  });

  assert.equal(registered.user.role, "student");
  assert.equal(registered.user.email, "chenxing@whu.edu.cn");

  const session = login(registered.state, {
    email: "chenxing@whu.edu.cn",
    password: "Passw0rd!"
  });

  assert.equal(session.user.name, "陈星");
  assert.match(session.token, /^session_/);
});

test("user can choose a permission role without identity verification", () => {
  const mentor = registerUser(createInitialState(), {
    role: "mentor",
    name: "周同学",
    email: "mentor-like@whu.edu.cn",
    password: "Passw0rd!"
  });
  const collector = registerUser(mentor.state, {
    role: "certificate_collector",
    name: "材料同学",
    email: "collector-like@whu.edu.cn",
    password: "Passw0rd!"
  });

  assert.equal(mentor.user.role, "mentor");
  assert.equal(collector.user.role, "certificate_collector");
});

test("student can browse opportunities across competitions and research projects", () => {
  const state = createInitialState();

  const allOpportunities = listOpportunities(state);
  assert.deepEqual(
    allOpportunities.map((opportunity) => opportunity.type).sort(),
    ["competition", "competition", "research"]
  );

  const researchOnly = listOpportunities(state, { type: "research" });
  assert.equal(researchOnly.length, 1);
  assert.equal(researchOnly[0].title, "面向校园服务的智能问答系统");
});

test("student can publish a team recruit for an existing competition", () => {
  const registered = registerStudent(createInitialState(), {
    name: "李队长",
    email: "leader@whu.edu.cn",
    password: "Passw0rd!",
    major: "计算机科学",
    githubUrl: ""
  });

  const created = createTeamRecruit(registered.state, {
    competitionId: "competition_1",
    studentUserId: registered.user.id,
    title: "寻找前端和答辩同学",
    skills: ["Vue", "PPT"],
    contact: "QQ 123456789"
  });

  assert.equal(created.recruit.status, "有效");
  assert.equal(created.recruit.title, "寻找前端和答辩同学");

  const detail = getCompetitionDetail(created.state, "competition_1");
  assert.equal(detail.teamRecruits.length, 1);
  assert.equal(detail.teamRecruits[0].publisherName, "李队长");
});

test("student can apply to an open research project and mentor can review it", () => {
  const registered = registerStudent(createInitialState(), {
    name: "王同学",
    email: "student@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程",
    githubUrl: "https://github.com/student"
  });

  const applied = applyToResearchProject(registered.state, {
    researchId: "research_1",
    studentUserId: registered.user.id,
    statement: "我做过课程项目中的前端和检索模块，希望参与原型开发。"
  });

  assert.equal(applied.application.status, "待审核");

  const applications = listResearchApplicationsForMentor(
    applied.state,
    "mentor_1"
  );
  assert.equal(applications.length, 1);
  assert.equal(applications[0].studentName, "王同学");
  assert.equal(applications[0].researchTitle, "面向校园服务的智能问答系统");
});

test("student can upload a valid certificate record and list it later", () => {
  const registered = registerStudent(createInitialState(), {
    name: "赵同学",
    email: "zhao@whu.edu.cn",
    password: "Passw0rd!",
    major: "信息安全",
    githubUrl: ""
  });

  const uploaded = uploadCertificateRecord(registered.state, {
    studentUserId: registered.user.id,
    competitionId: "competition_1",
    awardLevel: "二等奖",
    awardDate: "2026-05-01",
    fileName: "certificate.pdf",
    fileSizeBytes: 2 * 1024 * 1024
  });

  assert.equal(uploaded.certificateRecord.awardLevel, "二等奖");
  assert.match(uploaded.certificateRecord.fileUrl, /certificate\.pdf$/);

  const records = listCertificateRecords(uploaded.state, registered.user.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].competitionTitle, "中国大学生服务外包创新创业大赛");
});

test("certificate collector can review readable records from uploaders", () => {
  const student = registerStudent(createInitialState(), {
    name: "赵同学",
    email: "zhao@whu.edu.cn",
    password: "Passw0rd!",
    major: "信息安全",
    githubUrl: ""
  });
  const uploadedByStudent = uploadCertificateRecord(student.state, {
    studentUserId: student.user.id,
    competitionId: "competition_1",
    awardLevel: "二等奖",
    awardDate: "2026-05-01",
    fileName: "certificate.pdf",
    fileSizeBytes: 2 * 1024 * 1024
  });
  const collector = registerUser(uploadedByStudent.state, {
    role: "certificate_collector",
    name: "材料收集员",
    email: "collector@whu.edu.cn",
    password: "Passw0rd!"
  });

  const collection = listCertificateCollection(
    collector.state,
    collector.user.id
  );

  assert.equal(collection.length, 1);
  assert.equal(collection[0].uploaderName, "赵同学");
  assert.equal(collection[0].awardSummary, "中国大学生服务外包创新创业大赛 · 二等奖");
  assert.equal(collection[0].fileSummary, "certificate.pdf · 2.0 MB");
});

test("early user usage information and manual feedback can be collected", () => {
  const registered = registerUser(createInitialState(), {
    role: "student",
    name: "反馈同学",
    email: "feedback@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const used = recordUsage(registered.state, {
    userId: registered.user.id,
    action: "view_opportunity",
    target: "competition_1"
  });

  const submitted = submitFeedback(used.state, {
    userId: registered.user.id,
    contact: "feedback@whu.edu.cn",
    painPoint: "找队友信息太分散",
    message: "希望组队招募能直接看到联系方式和技能标签。",
    rating: 4
  });

  const entries = listFeedbackEntries(submitted.state);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].userName, "反馈同学");
  assert.equal(entries[0].roleLabel, "学生");
  assert.equal(entries[0].usageCount, 1);
  assert.equal(entries[0].painPoint, "找队友信息太分散");
});
