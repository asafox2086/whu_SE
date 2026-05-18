export class DomainError extends Error {
  constructor(message, code = "DOMAIN_ERROR") {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createInitialState() {
  return {
    users: [],
    students: [],
    mentors: [
      {
        id: "mentor_1",
        userId: "user_mentor_1",
        name: "周老师",
        department: "计算机学院"
      }
    ],
    certificateCollectors: [],
    competitions: [
      {
        id: "competition_1",
        title: "中国大学生服务外包创新创业大赛",
        level: "国家级",
        officialUrl: "https://www.fwwb.org.cn/",
        qqGroup: "812345678",
        startDate: "2026-05-20",
        endDate: "2026-07-10",
        description: "适合软件工程、产品设计和商业策划方向同学组队参赛。"
      },
      {
        id: "competition_2",
        title: "挑战杯大学生课外学术科技作品竞赛",
        level: "国家级",
        officialUrl: "https://www.tiaozhanbei.net/",
        qqGroup: "823456789",
        startDate: "2026-06-01",
        endDate: "2026-09-01",
        description: "鼓励跨学科团队提交科技创新作品。"
      }
    ],
    researchProjects: [
      {
        id: "research_1",
        mentorId: "mentor_1",
        title: "面向校园服务的智能问答系统",
        direction: "自然语言处理",
        techStack: ["JavaScript", "向量检索", "RAG"],
        qqGroup: "834567890",
        description: "构建面向学生事务咨询的原型系统，招募前端与算法方向同学。",
        status: "招募中"
      }
    ],
    teamRecruits: [],
    applications: [],
    certificateRecords: [],
    usageEvents: [],
    feedbackEntries: []
  };
}

export function registerStudent(state, payload) {
  return registerUser(state, { ...payload, role: "student" });
}

export function registerUser(state, payload) {
  const next = cloneState(state);
  const name = requiredText(payload.name, "姓名");
  const email = normalizeEmail(payload.email);
  const password = requiredText(payload.password, "密码");
  const role = normalizeRole(payload.role);

  if (password.length < 8) {
    throw new DomainError("密码至少需要 8 位", "WEAK_PASSWORD");
  }
  if (next.users.some((user) => user.email === email)) {
    throw new DomainError("邮箱已被注册", "EMAIL_TAKEN");
  }

  const user = {
    id: nextId("user", next.users),
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    status: "正常"
  };

  next.users.push(user);
  if (role === "student") {
    next.students.push({
      id: nextId("student", next.students),
      userId: user.id,
      major: optionalText(payload.major, "未填写专业"),
      githubUrl: payload.githubUrl?.trim() ?? ""
    });
  }
  if (role === "mentor") {
    next.mentors.push({
      id: nextId("mentor", next.mentors),
      userId: user.id,
      name,
      department: optionalText(payload.department, "待补充院系")
    });
  }
  if (role === "certificate_collector") {
    next.certificateCollectors.push({
      id: nextId("collector", next.certificateCollectors),
      userId: user.id,
      name
    });
  }

  return {
    state: next,
    user: publicUser(user)
  };
}

export function login(state, payload) {
  const email = normalizeEmail(payload.email);
  const password = requiredText(payload.password, "密码");
  const user = state.users.find((candidate) => candidate.email === email);

  if (!user || user.passwordHash !== hashPassword(password)) {
    throw new DomainError("邮箱或密码错误", "BAD_CREDENTIALS");
  }
  if (user.status !== "正常") {
    throw new DomainError("账号当前不可登录", "USER_BLOCKED");
  }

  return {
    token: `session_${user.id}_${Date.now().toString(36)}`,
    user: publicUser(user)
  };
}

export function listOpportunities(state, filters = {}) {
  const opportunities = [
    ...state.competitions.map((competition) => ({
      id: competition.id,
      type: "competition",
      title: competition.title,
      subtitle: `${competition.level} · ${competition.startDate} 至 ${competition.endDate}`,
      tags: [competition.level],
      description: competition.description,
      contact: `QQ群 ${competition.qqGroup}`
    })),
    ...state.researchProjects
      .filter((project) => project.status === "招募中")
      .map((project) => ({
        id: project.id,
        type: "research",
        title: project.title,
        subtitle: `${project.direction} · ${project.status}`,
        tags: project.techStack,
        description: project.description,
        contact: `QQ群 ${project.qqGroup}`
      }))
  ];

  return opportunities.filter((opportunity) => {
    if (filters.type && opportunity.type !== filters.type) {
      return false;
    }
    if (filters.keyword) {
      const keyword = filters.keyword.trim().toLowerCase();
      const searchable = [
        opportunity.title,
        opportunity.subtitle,
        opportunity.description,
        opportunity.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(keyword);
    }
    return true;
  });
}

export function createTeamRecruit(state, payload) {
  const next = cloneState(state);
  const competition = next.competitions.find((item) => item.id === payload.competitionId);
  if (!competition) {
    throw new DomainError("竞赛不存在", "COMPETITION_NOT_FOUND");
  }

  const student = findStudentByUserId(next, payload.studentUserId);
  const title = requiredText(payload.title, "招募标题");
  const contact = requiredText(payload.contact, "联系方式");
  const skills = normalizeTags(payload.skills, "技能标签");

  const recruit = {
    id: nextId("recruit", next.teamRecruits),
    competitionId: competition.id,
    studentId: student.id,
    title,
    skills,
    contact,
    publishTime: new Date().toISOString(),
    status: "有效"
  };

  next.teamRecruits.push(recruit);

  return {
    state: next,
    recruit: presentTeamRecruit(next, recruit)
  };
}

export function getCompetitionDetail(state, competitionId) {
  const competition = state.competitions.find((item) => item.id === competitionId);
  if (!competition) {
    throw new DomainError("竞赛不存在", "COMPETITION_NOT_FOUND");
  }

  return {
    ...competition,
    teamRecruits: state.teamRecruits
      .filter((recruit) => recruit.competitionId === competition.id && recruit.status === "有效")
      .map((recruit) => presentTeamRecruit(state, recruit))
  };
}

export function applyToResearchProject(state, payload) {
  const next = cloneState(state);
  const research = next.researchProjects.find((item) => item.id === payload.researchId);
  if (!research) {
    throw new DomainError("科研项目不存在", "RESEARCH_NOT_FOUND");
  }
  if (research.status !== "招募中") {
    throw new DomainError("项目已停止招募", "RESEARCH_CLOSED");
  }

  const student = findStudentByUserId(next, payload.studentUserId);
  const statement = requiredText(payload.statement, "个人陈述");

  const application = {
    id: nextId("application", next.applications),
    targetType: "research",
    targetId: research.id,
    studentId: student.id,
    statement,
    applyTime: new Date().toISOString(),
    status: "待审核"
  };

  next.applications.push(application);

  return {
    state: next,
    application: presentApplication(next, application)
  };
}

export function listResearchApplicationsForMentor(state, mentorId) {
  const researchIds = new Set(
    state.researchProjects
      .filter((project) => project.mentorId === mentorId)
      .map((project) => project.id)
  );

  return state.applications
    .filter(
      (application) =>
        application.targetType === "research" && researchIds.has(application.targetId)
    )
    .map((application) => presentApplication(state, application));
}

export function uploadCertificateRecord(state, payload) {
  const next = cloneState(state);
  const student = findStudentByUserId(next, payload.studentUserId);
  const competition = next.competitions.find((item) => item.id === payload.competitionId);
  if (!competition) {
    throw new DomainError("竞赛不存在", "COMPETITION_NOT_FOUND");
  }

  const fileName = requiredText(payload.fileName, "证书文件名");
  const fileSizeBytes = Number(payload.fileSizeBytes);
  const extension = fileName.split(".").pop()?.toLowerCase();
  const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);
  if (!allowedExtensions.has(extension)) {
    throw new DomainError("证书文件仅支持 PDF/JPG/PNG", "UNSUPPORTED_CERTIFICATE_FILE");
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new DomainError("证书文件大小不正确", "INVALID_FILE_SIZE");
  }
  if (fileSizeBytes > 5 * 1024 * 1024) {
    throw new DomainError("证书文件不能超过 5MB", "CERTIFICATE_FILE_TOO_LARGE");
  }

  const certificateRecord = {
    id: nextId("certificate", next.certificateRecords),
    studentId: student.id,
    competitionId: competition.id,
    awardLevel: requiredText(payload.awardLevel, "奖项等级"),
    awardDate: requiredText(payload.awardDate, "获奖时间"),
    fileUrl: `/uploads/certificates/${encodeURIComponent(fileName)}`,
    fileName,
    fileSizeBytes,
    status: "完成"
  };

  next.certificateRecords.push(certificateRecord);

  return {
    state: next,
    certificateRecord: presentCertificateRecord(next, certificateRecord)
  };
}

export function listCertificateRecords(state, studentUserId) {
  const student = findStudentByUserId(state, studentUserId);
  return state.certificateRecords
    .filter((record) => record.studentId === student.id)
    .map((record) => presentCertificateRecord(state, record));
}

export function listCertificateCollection(state, collectorUserId) {
  findCertificateCollectorByUserId(state, collectorUserId);
  return certificateRecordsOf(state).map((record) => presentCertificateRecord(state, record));
}

export function recordUsage(state, payload) {
  const next = cloneState(state);
  const user = payload.userId ? findUserById(next, payload.userId) : null;
  const usageEvent = {
    id: nextId("usage", usageEventsOf(next)),
    userId: user?.id ?? null,
    action: requiredText(payload.action, "使用动作"),
    target: `${payload.target ?? ""}`.trim(),
    occurredAt: new Date().toISOString()
  };

  next.usageEvents = usageEventsOf(next);
  next.usageEvents.push(usageEvent);

  return {
    state: next,
    usageEvent
  };
}

export function submitFeedback(state, payload) {
  const next = cloneState(state);
  const user = payload.userId ? findUserById(next, payload.userId) : null;
  const rating = Number(payload.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new DomainError("评分需要在 1 到 5 之间", "INVALID_RATING");
  }

  const feedback = {
    id: nextId("feedback", feedbackEntriesOf(next)),
    userId: user?.id ?? null,
    contact: requiredText(payload.contact, "联系方式"),
    painPoint: requiredText(payload.painPoint, "用户痛点"),
    message: requiredText(payload.message, "反馈内容"),
    rating,
    submittedAt: new Date().toISOString()
  };

  next.feedbackEntries = feedbackEntriesOf(next);
  next.feedbackEntries.push(feedback);

  return {
    state: next,
    feedback: presentFeedback(next, feedback)
  };
}

export function listFeedbackEntries(state) {
  return feedbackEntriesOf(state).map((feedback) => presentFeedback(state, feedback));
}

function cloneState(state) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(state)
    : JSON.parse(JSON.stringify(state));
}

function findCertificateCollectorByUserId(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  const collector = state.certificateCollectors.find(
    (candidate) => candidate.userId === userId
  );
  if (!user || !collector || user.role !== "certificate_collector") {
    throw new DomainError("只有证书收集者可以查看汇总", "CERTIFICATE_COLLECTOR_REQUIRED");
  }
  return collector;
}

function findUserById(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new DomainError("用户不存在", "USER_NOT_FOUND");
  }
  return user;
}

function findStudentByUserId(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  const student = state.students.find((candidate) => candidate.userId === userId);
  if (!user || !student || user.role !== "student") {
    throw new DomainError("只有学生可以执行该操作", "STUDENT_REQUIRED");
  }
  return student;
}

function certificateRecordsOf(state) {
  return state.certificateRecords ?? [];
}

function feedbackEntriesOf(state) {
  return state.feedbackEntries ?? [];
}

function usageEventsOf(state) {
  return state.usageEvents ?? [];
}

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size)) {
    return "未知大小";
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function roleLabel(role) {
  const labels = {
    student: "学生",
    mentor: "导师",
    certificate_collector: "证书收集者"
  };
  return labels[role] ?? "未知身份";
}

function hashPassword(password) {
  let hash = 0;
  for (const char of password) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `local_${hash.toString(16)}`;
}

function normalizeTags(tags, label) {
  const values = Array.isArray(tags)
    ? tags
    : `${tags ?? ""}`
        .split(",")
        .map((tag) => tag.trim());
  const normalized = values.map((tag) => `${tag}`.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new DomainError(`${label}不能为空`, "REQUIRED_FIELD");
  }
  return normalized;
}

function nextId(prefix, collection) {
  return `${prefix}_${collection.length + 1}`;
}

function presentCertificateRecord(state, certificateRecord) {
  const competition = state.competitions.find(
    (item) => item.id === certificateRecord.competitionId
  );
  const student = state.students.find((candidate) => candidate.id === certificateRecord.studentId);
  const user = state.users.find((candidate) => candidate.id === student?.userId);
  const competitionTitle = competition?.title ?? "未知竞赛";
  return {
    ...certificateRecord,
    competitionTitle,
    uploaderName: user?.name ?? "未知上传者",
    awardSummary: `${competitionTitle} · ${certificateRecord.awardLevel}`,
    fileSummary: `${certificateRecord.fileName} · ${formatBytes(certificateRecord.fileSizeBytes)}`
  };
}

function presentFeedback(state, feedback) {
  const user = feedback.userId
    ? state.users.find((candidate) => candidate.id === feedback.userId)
    : null;
  const usageCount = usageEventsOf(state).filter(
    (event) => event.userId === feedback.userId
  ).length;

  return {
    ...feedback,
    userName: user?.name ?? "匿名用户",
    roleLabel: roleLabel(user?.role),
    usageCount
  };
}

function presentApplication(state, application) {
  const student = state.students.find((candidate) => candidate.id === application.studentId);
  const user = state.users.find((candidate) => candidate.id === student?.userId);
  const research = application.targetType === "research"
    ? state.researchProjects.find((project) => project.id === application.targetId)
    : null;

  return {
    ...application,
    studentName: user?.name ?? "未知学生",
    researchTitle: research?.title
  };
}

function presentTeamRecruit(state, recruit) {
  const student = state.students.find((candidate) => candidate.id === recruit.studentId);
  const user = state.users.find((candidate) => candidate.id === student?.userId);
  return {
    ...recruit,
    publisherName: user?.name ?? "未知学生"
  };
}

function normalizeEmail(email) {
  const normalized = requiredText(email, "邮箱").toLowerCase();
  if (!emailPattern.test(normalized)) {
    throw new DomainError("邮箱格式不正确", "INVALID_EMAIL");
  }
  return normalized;
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeRole(role) {
  const normalized = `${role ?? "student"}`.trim();
  const roles = new Set(["student", "mentor", "certificate_collector"]);
  if (!roles.has(normalized)) {
    throw new DomainError("权限身份不正确", "INVALID_ROLE");
  }
  return normalized;
}

function requiredText(value, label) {
  const text = `${value ?? ""}`.trim();
  if (!text) {
    throw new DomainError(`${label}不能为空`, "REQUIRED_FIELD");
  }
  return text;
}

function optionalText(value, fallback) {
  const text = `${value ?? ""}`.trim();
  return text || fallback;
}
