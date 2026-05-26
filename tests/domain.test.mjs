import test from "node:test";
import assert from "node:assert/strict";

import {
  applyToResearchProject,
  createCompetition,
  createTeamRecruit,
  createInitialState,
  createResearchProject,
  blockUser,
  deleteCertificateRecord,
  deleteResearchProject,
  deleteResearchApplication,
  deleteTeamRecruit,
  deleteUser,
  deleteDatabaseRecord,
  getAdminDatabaseView,
  getDatabaseSnapshot,
  getCompetitionDetail,
  getResearchDetail,
  listRegisteredUsers,
  listCertificateRecords,
  listCertificateCollection,
  listCertificateCollectionByCompetition,
  listResearchApplicationsForMentor,
  listResearchApplicationsForStudent,
  listTeamRecruitsForStudent,
  listResearchProjectsForMentor,
  listOpportunities,
  login,
  listFeedbackEntries,
  recordUsage,
  reviewResearchApplication,
  resumeTeamRecruit,
  registerUser,
  registerStudent,
  stopTeamRecruit,
  submitFeedback,
  uploadCertificateRecord
} from "../src/domain.mjs";

test("student can register and then log in", () => {
  const registered = registerStudent(createInitialState(), {
    name: "陈星",
    email: "chenxing-new@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程",
    githubUrl: "https://github.com/chenxing"
  });

  assert.equal(registered.user.role, "student");
  assert.equal(registered.user.email, "chenxing-new@whu.edu.cn");

  const session = login(registered.state, {
    email: "chenxing-new@whu.edu.cn",
    password: "Passw0rd!"
  });

  assert.equal(session.user.name, "陈星");
  assert.match(session.token, /^session_/);
});

test("initial demo state looks like an active campus MVP", () => {
  const state = createInitialState();

  assert.ok(state.users.length >= 12);
  assert.ok(state.competitions.length >= 5);
  assert.ok(state.researchProjects.length >= 4);
  assert.ok(state.teamRecruits.length >= 10);
  assert.ok(state.applications.length >= 6);
  assert.ok(state.usageEvents.length >= 15);
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
  assert.ok(users.some((user) => user.id === admin.user.id && user.role === "admin"));
  assert.ok(users.some((user) => user.id === student.user.id && user.role === "student"));

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
    admin.state.competitions.length - 1
  );

  const withoutResearch = deleteDatabaseRecord(withoutCompetition.state, admin.user.id, {
    table: "researchProjects",
    id: "research_1"
  });
  assert.equal(
    getDatabaseSnapshot(withoutResearch.state, admin.user.id).tables.researchProjects.length,
    withoutCompetition.state.researchProjects.length - 1
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
  const usageRecord = usageTable.records.find((record) =>
    record.fields.some((field) => field.value === "使用同学 · 学生")
  );

  assert.equal(usageRecord.title, "浏览机会");
  assert.equal(usageRecord.summary, "中国大学生服务外包创新创业大赛");
  assert.deepEqual(usageRecord.fields[0], {
    label: "用户",
    value: "使用同学 · 学生"
  });
  assert.deepEqual(usageRecord.fields[1], {
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

test("admin can block and delete registered users", () => {
  const initial = createInitialState();
  const admin = registerUser(initial, {
    role: "admin",
    name: "管理员",
    email: "admin-users@whu.edu.cn",
    password: "Passw0rd!"
  });
  const student = registerStudent(admin.state, {
    name: "待处理同学",
    email: "blocked@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });

  const blocked = blockUser(student.state, admin.user.id, student.user.id);
  assert.equal(
    listRegisteredUsers(blocked.state, admin.user.id).find((user) => user.id === student.user.id).status,
    "封禁"
  );
  assert.throws(
    () => login(blocked.state, {
      role: "student",
      email: "blocked@whu.edu.cn",
      password: "Passw0rd!"
    }),
    /账号当前不可登录/
  );

  const deleted = deleteUser(blocked.state, admin.user.id, student.user.id);
  assert.ok(!listRegisteredUsers(deleted.state, admin.user.id).some((user) => user.id === student.user.id));
  assert.equal(getDatabaseSnapshot(deleted.state, admin.user.id).tables.students.length, initial.students.length);
});

test("mentor can add and delete their own research projects", () => {
  const mentor = registerUser(createInitialState(), {
    role: "mentor",
    name: "刘老师",
    email: "mentor-create@whu.edu.cn",
    password: "Passw0rd!",
    department: "计算机学院"
  });

  const created = createResearchProject(mentor.state, mentor.user.id, {
    title: "可信软件测试工具",
    direction: "软件工程",
    techStack: "JavaScript, 自动化测试",
    qqGroup: "867890123",
    description: "面向课程项目构建自动化测试和质量分析工具。",
    status: "招募中"
  });

  const mentorProjects = listResearchProjectsForMentor(created.state, mentor.user.id);
  assert.equal(mentorProjects.length, 1);
  assert.equal(mentorProjects[0].title, "可信软件测试工具");
  assert.ok(listOpportunities(created.state).some((opportunity) => opportunity.id === created.researchProject.id));

  const deleted = deleteResearchProject(created.state, mentor.user.id, created.researchProject.id);
  assert.equal(listResearchProjectsForMentor(deleted.state, mentor.user.id).length, 0);
  assert.ok(!listOpportunities(deleted.state).some((opportunity) => opportunity.id === created.researchProject.id));
});

test("mentor can approve or reject research applications with student-facing result details", () => {
  const mentor = registerUser(createInitialState(), {
    role: "mentor",
    name: "审阅导师",
    email: "reviewer@whu.edu.cn",
    password: "Passw0rd!",
    department: "计算机学院"
  });
  const project = createResearchProject(mentor.state, mentor.user.id, {
    title: "课程知识图谱构建",
    direction: "知识工程",
    techStack: ["Python", "Neo4j"],
    qqGroup: "878901234",
    description: "整理课程实体关系并构建可查询原型。"
  });
  const student = registerStudent(project.state, {
    name: "申请同学",
    email: "apply-review@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const applied = applyToResearchProject(student.state, {
    researchId: project.researchProject.id,
    studentUserId: student.user.id,
    statement: "我做过图数据库课程实验，希望参与。"
  });

  const approved = reviewResearchApplication(applied.state, mentor.user.id, {
    applicationId: applied.application.id,
    decision: "approve",
    contact: "QQ群 878901234，备注：知识图谱申请",
    feedback: "基础匹配，先加入群沟通任务。"
  });
  const studentApplications = listResearchApplicationsForStudent(approved.state, student.user.id);

  assert.equal(studentApplications[0].status, "已通过");
  assert.equal(studentApplications[0].mentorContact, "QQ群 878901234，备注：知识图谱申请");
  assert.equal(studentApplications[0].mentorFeedback, "基础匹配，先加入群沟通任务。");

  const secondStudent = registerStudent(approved.state, {
    name: "另一个同学",
    email: "reject-review@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const secondApplied = applyToResearchProject(secondStudent.state, {
    researchId: project.researchProject.id,
    studentUserId: secondStudent.user.id,
    statement: "暂时只有一点兴趣。"
  });
  const rejected = reviewResearchApplication(secondApplied.state, mentor.user.id, {
    applicationId: secondApplied.application.id,
    decision: "reject",
    feedback: "本轮需要有课程项目或检索经验，可以下轮再投。"
  });
  const rejectedApplications = listResearchApplicationsForStudent(rejected.state, secondStudent.user.id);

  assert.equal(rejectedApplications[0].status, "未通过");
  assert.equal(rejectedApplications[0].mentorContact, "");
  assert.equal(rejectedApplications[0].mentorFeedback, "本轮需要有课程项目或检索经验，可以下轮再投。");
});

test("student can delete their own research application", () => {
  const registered = registerStudent(createInitialState(), {
    name: "撤回同学",
    email: "delete-application@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const applied = applyToResearchProject(registered.state, {
    researchId: "research_1",
    studentUserId: registered.user.id,
    statement: "我想先提交，之后可能调整。"
  });

  const deleted = deleteResearchApplication(
    applied.state,
    registered.user.id,
    applied.application.id
  );

  assert.equal(listResearchApplicationsForStudent(deleted.state, registered.user.id).length, 0);
  assert.equal(listResearchApplicationsForMentor(deleted.state, "mentor_1").length, 0);
});

test("student can delete their own uploaded certificate record", () => {
  const student = registerStudent(createInitialState(), {
    name: "证书同学",
    email: "delete-certificate@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const uploaded = uploadCertificateRecord(student.state, {
    studentUserId: student.user.id,
    competitionId: "competition_1",
    awardLevel: "一等奖",
    awardDate: "2026-05-08",
    fileName: "award.pdf",
    fileSizeBytes: 128 * 1024,
    fileDataUrl: "data:application/pdf;base64,JVBERi0x"
  });

  const deleted = deleteCertificateRecord(
    uploaded.state,
    student.user.id,
    uploaded.certificateRecord.id
  );

  assert.equal(listCertificateRecords(deleted.state, student.user.id).length, 0);
});

test("student can end, resume, and delete their own team recruit", () => {
  const student = registerStudent(createInitialState(), {
    name: "队长同学",
    email: "recruit-owner@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const created = createTeamRecruit(student.state, {
    competitionId: "competition_1",
    studentUserId: student.user.id,
    title: "寻找后端和算法同学",
    skills: ["Node.js", "算法"],
    contact: "QQ 123123123"
  });

  const stopped = stopTeamRecruit(created.state, student.user.id, created.recruit.id);
  assert.equal(listTeamRecruitsForStudent(stopped.state, student.user.id)[0].status, "已结束");
  assert.ok(!getCompetitionDetail(stopped.state, "competition_1").teamRecruits.some((recruit) => recruit.id === created.recruit.id));

  const resumed = resumeTeamRecruit(stopped.state, student.user.id, created.recruit.id);
  assert.equal(listTeamRecruitsForStudent(resumed.state, student.user.id)[0].status, "招募中");
  assert.ok(getCompetitionDetail(resumed.state, "competition_1").teamRecruits.some((recruit) => recruit.id === created.recruit.id));

  const deleted = deleteTeamRecruit(resumed.state, student.user.id, created.recruit.id);
  assert.equal(listTeamRecruitsForStudent(deleted.state, student.user.id).length, 0);
});

test("certificate collector can review certificates grouped by competition with downloadable archive names", () => {
  const firstStudent = registerStudent(createInitialState(), {
    name: "赵同学",
    email: "zhao-download@whu.edu.cn",
    password: "Passw0rd!",
    major: "信息安全"
  });
  const firstUploaded = uploadCertificateRecord(firstStudent.state, {
    studentUserId: firstStudent.user.id,
    competitionId: "competition_1",
    awardLevel: "二等奖",
    awardDate: "2026-05-01",
    fileName: "zhao-award.pdf",
    fileSizeBytes: 2 * 1024,
    fileDataUrl: "data:application/pdf;base64,emhhbw=="
  });
  const secondStudent = registerStudent(firstUploaded.state, {
    name: "钱同学",
    email: "qian-download@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const secondUploaded = uploadCertificateRecord(secondStudent.state, {
    studentUserId: secondStudent.user.id,
    competitionId: "competition_1",
    awardLevel: "三等奖",
    awardDate: "2026-05-02",
    fileName: "qian-award.jpg",
    fileSizeBytes: 1024,
    fileDataUrl: "data:image/jpeg;base64,cWlhbg=="
  });
  const collector = registerUser(secondUploaded.state, {
    role: "certificate_collector",
    name: "材料收集者",
    email: "collector-download@whu.edu.cn",
    password: "Passw0rd!"
  });

  const groups = listCertificateCollectionByCompetition(collector.state, collector.user.id);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].competitionTitle, "中国大学生服务外包创新创业大赛");
  assert.equal(groups[0].records.length, 2);
  assert.equal(groups[0].archiveName, "中国大学生服务外包创新创业大赛-证书合集.zip");
  assert.deepEqual(
    groups[0].records.map((record) => record.archiveFileName),
    ["赵同学.pdf", "钱同学.jpg"]
  );
  assert.equal(groups[0].records[0].downloadUrl, "data:application/pdf;base64,emhhbw==");
});

test("student can browse opportunities across competitions and research projects", () => {
  const state = createInitialState();

  const allOpportunities = listOpportunities(state);
  assert.ok(allOpportunities.filter((opportunity) => opportunity.type === "competition").length >= 2);
  assert.ok(allOpportunities.filter((opportunity) => opportunity.type === "research").length >= 1);

  const researchOnly = listOpportunities(state, { type: "research" });
  assert.ok(researchOnly.length >= 1);
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

  assert.equal(created.recruit.status, "招募中");
  assert.equal(created.recruit.title, "寻找前端和答辩同学");

  const detail = getCompetitionDetail(created.state, "competition_1");
  assert.ok(detail.teamRecruits.some((candidate) => candidate.id === created.recruit.id));
  assert.equal(
    detail.teamRecruits.find((candidate) => candidate.id === created.recruit.id).publisherName,
    "李队长"
  );
});

test("student can publish a team recruit for an open research project", () => {
  const registered = registerStudent(createInitialState(), {
    name: "科研组队同学",
    email: "research-recruit@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程",
    githubUrl: ""
  });

  const created = createTeamRecruit(registered.state, {
    targetType: "research",
    targetId: "research_1",
    studentUserId: registered.user.id,
    title: "寻找 RAG 评测搭子",
    skills: ["RAG", "评测"],
    contact: "QQ 654321"
  });

  const detail = getResearchDetail(created.state, "research_1");
  assert.ok(detail.teamRecruits.some((recruit) => recruit.id === created.recruit.id));
  assert.equal(created.recruit.targetType, "research");
  assert.equal(created.recruit.opportunityTitle, detail.title);
});

test("legacy team recruit statuses are presented with the current wording", () => {
  const student = registerStudent(createInitialState(), {
    name: "旧数据同学",
    email: "legacy-recruit@whu.edu.cn",
    password: "Passw0rd!",
    major: "软件工程"
  });
  const created = createTeamRecruit(student.state, {
    competitionId: "competition_1",
    studentUserId: student.user.id,
    title: "兼容旧招募状态",
    skills: ["测试"],
    contact: "QQ 456456456"
  });
  const createdRecruit = created.state.teamRecruits.find((recruit) => recruit.id === created.recruit.id);
  createdRecruit.status = "有效";

  assert.equal(listTeamRecruitsForStudent(created.state, student.user.id)[0].status, "招募中");
  assert.ok(getCompetitionDetail(created.state, "competition_1").teamRecruits.some((recruit) => recruit.id === created.recruit.id));

  createdRecruit.status = "不招了";
  assert.equal(listTeamRecruitsForStudent(created.state, student.user.id)[0].status, "已结束");
  assert.ok(!getCompetitionDetail(created.state, "competition_1").teamRecruits.some((recruit) => recruit.id === created.recruit.id));
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
