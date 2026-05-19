import test from "node:test";
import assert from "node:assert/strict";

import {
  applyToResearchProject,
  createCompetition,
  createTeamRecruit,
  createInitialState,
  createResearchProject,
  deleteDatabaseRecord,
  getAdminDatabaseView,
  getDatabaseSnapshot,
  getCompetitionDetail,
  listRegisteredUsers,
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

test("login uses the selected permission role when switching identities", () => {
  const collector = registerUser(createInitialState(), {
    role: "certificate_collector",
    name: "同一邮箱",
    email: "same@whu.edu.cn",
    password: "Passw0rd!"
  });
  const student = registerUser(collector.state, {
    role: "student",
    name: "同一邮箱",
    email: "same@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });

  const session = login(student.state, {
    role: "student",
    email: "same@whu.edu.cn",
    password: "Passw0rd!"
  });

  assert.equal(session.user.role, "student");
});

test("admin can inspect users and delete database records", () => {
  const admin = registerUser(createInitialState(), {
    role: "admin",
    name: "管理员",
    email: "admin@whu.edu.cn",
    password: "Passw0rd!"
  });
  const student = registerStudent(admin.state, {
    name: "待清理同学",
    email: "cleanup@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const uploaded = uploadCertificateRecord(student.state, {
    studentUserId: student.user.id,
    competitionId: "competition_1",
    awardLevel: "三等奖",
    awardDate: "2026-05-02",
    fileName: "cleanup.png",
    fileSizeBytes: 128 * 1024,
    fileDataUrl: "data:image/png;base64,abc"
  });

  const users = listRegisteredUsers(uploaded.state, admin.user.id);
  assert.deepEqual(
    users.map((user) => user.role),
    ["admin", "student"]
  );

  const snapshot = getDatabaseSnapshot(uploaded.state, admin.user.id);
  assert.equal(snapshot.tables.certificateRecords.length, 1);

  const deleted = deleteDatabaseRecord(uploaded.state, admin.user.id, {
    table: "certificateRecords",
    id: uploaded.certificateRecord.id
  });
  assert.equal(
    getDatabaseSnapshot(deleted.state, admin.user.id).tables.certificateRecords.length,
    0
  );
});

test("admin database view is readable and supports deleting competitions and research projects", () => {
  const admin = registerUser(createInitialState(), {
    role: "admin",
    name: "管理员",
    email: "admin-view@whu.edu.cn",
    password: "Passw0rd!"
  });

  const view = getAdminDatabaseView(admin.state, admin.user.id);
  const competitionTable = view.tables.find((table) => table.name === "competitions");
  const researchTable = view.tables.find((table) => table.name === "researchProjects");

  assert.equal(competitionTable.label, "竞赛");
  assert.equal(competitionTable.records[0].title, "中国大学生服务外包创新创业大赛");
  assert.deepEqual(competitionTable.records[0].fields[0], {
    label: "级别",
    value: "国家级"
  });
  assert.equal(competitionTable.records[0].canDelete, true);
  assert.equal(researchTable.records[0].canDelete, true);

  const withoutCompetition = deleteDatabaseRecord(admin.state, admin.user.id, {
    table: "competitions",
    id: "competition_1"
  });
  assert.equal(
    getDatabaseSnapshot(withoutCompetition.state, admin.user.id).tables.competitions.length,
    1
  );

  const withoutResearch = deleteDatabaseRecord(withoutCompetition.state, admin.user.id, {
    table: "researchProjects",
    id: "research_1"
  });
  assert.equal(
    getDatabaseSnapshot(withoutResearch.state, admin.user.id).tables.researchProjects.length,
    0
  );
});

test("admin usage records explain actions, users, and targets in readable language", () => {
  const admin = registerUser(createInitialState(), {
    role: "admin",
    name: "管理员",
    email: "admin-usage@whu.edu.cn",
    password: "Passw0rd!"
  });
  const student = registerUser(admin.state, {
    role: "student",
    name: "使用同学",
    email: "usage@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const used = recordUsage(student.state, {
    userId: student.user.id,
    action: "view_opportunity",
    target: "competition_1"
  });

  const view = getAdminDatabaseView(used.state, admin.user.id);
  const usageTable = view.tables.find((table) => table.name === "usageEvents");

  assert.equal(usageTable.records[0].title, "浏览机会");
  assert.equal(usageTable.records[0].summary, "中国大学生服务外包创新创业大赛");
  assert.deepEqual(usageTable.records[0].fields[0], {
    label: "用户",
    value: "使用同学 · 学生"
  });
  assert.deepEqual(usageTable.records[0].fields[1], {
    label: "目标",
    value: "中国大学生服务外包创新创业大赛"
  });
});

test("admin can add competitions and research projects for the opportunity hall", () => {
  const admin = registerUser(createInitialState(), {
    role: "admin",
    name: "管理员",
    email: "admin-create@whu.edu.cn",
    password: "Passw0rd!"
  });

  const withCompetition = createCompetition(admin.state, admin.user.id, {
    title: "蓝桥杯全国软件和信息技术专业人才大赛",
    level: "国家级",
    officialUrl: "https://dasai.lanqiao.cn/",
    qqGroup: "845678901",
    startDate: "2026-06-15",
    endDate: "2026-10-20",
    description: "适合算法、软件开发和电子信息方向同学报名。"
  });
  const withResearch = createResearchProject(withCompetition.state, admin.user.id, {
    title: "多模态课程资源检索系统",
    direction: "信息检索",
    techStack: "Python, Vue, 向量数据库",
    qqGroup: "856789012",
    description: "围绕课程资料构建可检索、可问答的原型系统。",
    status: "招募中"
  });

  const opportunities = listOpportunities(withResearch.state);
  assert.equal(withCompetition.competition.id, "competition_3");
  assert.equal(withResearch.researchProject.id, "research_2");
  assert.ok(
    opportunities.some((opportunity) => opportunity.title === "蓝桥杯全国软件和信息技术专业人才大赛")
  );
  assert.ok(
    opportunities.some((opportunity) => opportunity.title === "多模态课程资源检索系统")
  );
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

test("image certificate records keep a visible preview", () => {
  const student = registerStudent(createInitialState(), {
    name: "预览同学",
    email: "preview@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });

  const uploaded = uploadCertificateRecord(student.state, {
    studentUserId: student.user.id,
    competitionId: "competition_1",
    awardLevel: "一等奖",
    awardDate: "2026-05-03",
    fileName: "award.png",
    fileSizeBytes: 64 * 1024,
    fileDataUrl: "data:image/png;base64,preview"
  });

  assert.equal(uploaded.certificateRecord.hasPreview, true);
  assert.equal(uploaded.certificateRecord.previewUrl, "data:image/png;base64,preview");
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
