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
    admins: [],
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
  if (next.users.some((user) => user.email === email && user.role === role)) {
    throw new DomainError("该邮箱已注册这个权限身份", "EMAIL_ROLE_TAKEN");
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
  if (role === "admin") {
    next.admins.push({
      id: nextId("admin", next.admins ?? []),
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
  const role = payload.role ? normalizeRole(payload.role) : null;
  const user = state.users.find(
    (candidate) => candidate.email === email && (!role || candidate.role === role)
  );

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

export function createCompetition(state, adminUserId, payload) {
  findAdminByUserId(state, adminUserId);
  const next = cloneState(state);
  const competition = {
    id: nextId("competition", next.competitions),
    title: requiredText(payload.title, "竞赛名称"),
    level: requiredText(payload.level, "竞赛级别"),
    officialUrl: requiredText(payload.officialUrl, "竞赛官网"),
    qqGroup: requiredText(payload.qqGroup, "交流群"),
    startDate: requiredText(payload.startDate, "开始时间"),
    endDate: requiredText(payload.endDate, "结束时间"),
    description: requiredText(payload.description, "竞赛简介")
  };

  next.competitions.push(competition);

  return {
    state: next,
    competition
  };
}

export function createResearchProject(state, adminUserId, payload) {
  const actor = findResearchProjectMaintainer(state, adminUserId);
  const next = cloneState(state);
  const mentorId = actor.role === "mentor"
    ? actor.mentor.id
    : optionalText(payload.mentorId, next.mentors[0]?.id ?? "");
  if (!next.mentors.some((mentor) => mentor.id === mentorId)) {
    throw new DomainError("导师不存在", "MENTOR_NOT_FOUND");
  }

  const researchProject = {
    id: nextId("research", next.researchProjects),
    mentorId,
    title: requiredText(payload.title, "科研项目名称"),
    direction: requiredText(payload.direction, "科研方向"),
    techStack: normalizeTags(payload.techStack, "技术栈"),
    qqGroup: requiredText(payload.qqGroup, "交流群"),
    description: requiredText(payload.description, "科研项目简介"),
    status: optionalText(payload.status, "招募中")
  };

  next.researchProjects.push(researchProject);

  return {
    state: next,
    researchProject
  };
}

export function listResearchProjectsForMentor(state, mentorIdentifier) {
  const mentorId = resolveMentorId(state, mentorIdentifier);
  return state.researchProjects
    .filter((project) => project.mentorId === mentorId)
    .map((project) => presentResearchProject(state, project));
}

export function deleteResearchProject(state, mentorUserId, researchId) {
  const mentor = findMentorByUserId(state, mentorUserId);
  const next = cloneState(state);
  const project = next.researchProjects.find((item) => item.id === researchId);
  if (!project) {
    throw new DomainError("科研项目不存在", "RESEARCH_NOT_FOUND");
  }
  if (project.mentorId !== mentor.id) {
    throw new DomainError("只能维护自己发布的科研项目", "MENTOR_PROJECT_FORBIDDEN");
  }

  next.researchProjects = next.researchProjects.filter((item) => item.id !== researchId);
  next.applications = next.applications.filter(
    (application) => !(application.targetType === "research" && application.targetId === researchId)
  );

  return {
    state: next
  };
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
    status: "招募中"
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
      .filter((recruit) => recruit.competitionId === competition.id && isOpenTeamRecruit(recruit))
      .map((recruit) => presentTeamRecruit(state, recruit))
  };
}

export function listTeamRecruitsForStudent(state, studentUserId) {
  const student = findStudentByUserId(state, studentUserId);
  return state.teamRecruits
    .filter((recruit) => recruit.studentId === student.id)
    .map((recruit) => presentTeamRecruit(state, recruit));
}

export function stopTeamRecruit(state, studentUserId, recruitId) {
  const student = findStudentByUserId(state, studentUserId);
  const next = cloneState(state);
  const recruit = next.teamRecruits.find((item) => item.id === recruitId);
  if (!recruit) {
    throw new DomainError("组队招募不存在", "TEAM_RECRUIT_NOT_FOUND");
  }
  if (recruit.studentId !== student.id) {
    throw new DomainError("只能操作自己发布的组队招募", "TEAM_RECRUIT_FORBIDDEN");
  }

  recruit.status = "已结束";

  return {
    state: next,
    recruit: presentTeamRecruit(next, recruit)
  };
}

export function resumeTeamRecruit(state, studentUserId, recruitId) {
  const student = findStudentByUserId(state, studentUserId);
  const next = cloneState(state);
  const recruit = next.teamRecruits.find((item) => item.id === recruitId);
  if (!recruit) {
    throw new DomainError("组队招募不存在", "TEAM_RECRUIT_NOT_FOUND");
  }
  if (recruit.studentId !== student.id) {
    throw new DomainError("只能操作自己发布的组队招募", "TEAM_RECRUIT_FORBIDDEN");
  }

  recruit.status = "招募中";

  return {
    state: next,
    recruit: presentTeamRecruit(next, recruit)
  };
}

export function deleteTeamRecruit(state, studentUserId, recruitId) {
  const student = findStudentByUserId(state, studentUserId);
  const next = cloneState(state);
  const recruit = next.teamRecruits.find((item) => item.id === recruitId);
  if (!recruit) {
    throw new DomainError("组队招募不存在", "TEAM_RECRUIT_NOT_FOUND");
  }
  if (recruit.studentId !== student.id) {
    throw new DomainError("只能删除自己发布的组队招募", "TEAM_RECRUIT_FORBIDDEN");
  }

  next.teamRecruits = next.teamRecruits.filter((item) => item.id !== recruitId);

  return {
    state: next
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
  const resolvedMentorId = resolveMentorId(state, mentorId);
  const researchIds = new Set(
    state.researchProjects
      .filter((project) => project.mentorId === resolvedMentorId)
      .map((project) => project.id)
  );

  return state.applications
    .filter(
      (application) =>
        application.targetType === "research" && researchIds.has(application.targetId)
    )
    .map((application) => presentApplication(state, application));
}

export function listResearchApplicationsForStudent(state, studentUserId) {
  const student = findStudentByUserId(state, studentUserId);
  return state.applications
    .filter((application) => application.studentId === student.id)
    .map((application) => presentApplication(state, application));
}

export function deleteResearchApplication(state, studentUserId, applicationId) {
  const student = findStudentByUserId(state, studentUserId);
  const next = cloneState(state);
  const application = next.applications.find((item) => item.id === applicationId);
  if (!application) {
    throw new DomainError("申请不存在", "APPLICATION_NOT_FOUND");
  }
  if (application.studentId !== student.id) {
    throw new DomainError("只能删除自己的申请", "STUDENT_APPLICATION_FORBIDDEN");
  }

  next.applications = next.applications.filter((item) => item.id !== applicationId);

  return {
    state: next
  };
}

export function reviewResearchApplication(state, mentorUserId, payload) {
  const mentor = findMentorByUserId(state, mentorUserId);
  const next = cloneState(state);
  const application = next.applications.find((item) => item.id === payload.applicationId);
  if (!application || application.targetType !== "research") {
    throw new DomainError("科研申请不存在", "APPLICATION_NOT_FOUND");
  }

  const project = next.researchProjects.find((item) => item.id === application.targetId);
  if (!project) {
    throw new DomainError("科研项目不存在", "RESEARCH_NOT_FOUND");
  }
  if (project.mentorId !== mentor.id) {
    throw new DomainError("只能审批自己科研项目的申请", "MENTOR_APPLICATION_FORBIDDEN");
  }

  const decision = normalizeReviewDecision(payload.decision);
  if (decision === "approve") {
    application.status = "已通过";
    application.mentorContact = requiredText(payload.contact, "后续联系方式");
    application.mentorFeedback = optionalText(payload.feedback, "请按联系方式继续沟通。");
  } else {
    application.status = "未通过";
    application.mentorContact = "";
    application.mentorFeedback = requiredText(payload.feedback, "未通过反馈");
  }
  application.reviewedAt = new Date().toISOString();

  return {
    state: next,
    application: presentApplication(next, application)
  };
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
    downloadUrl: optionalText(payload.fileDataUrl, ""),
    previewUrl: isImageFile(fileName) ? optionalText(payload.fileDataUrl, "") : "",
    hasPreview: isImageFile(fileName) && Boolean(`${payload.fileDataUrl ?? ""}`.trim()),
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

export function deleteCertificateRecord(state, studentUserId, certificateRecordId) {
  const student = findStudentByUserId(state, studentUserId);
  const next = cloneState(state);
  const certificateRecord = certificateRecordsOf(next).find((record) => record.id === certificateRecordId);
  if (!certificateRecord) {
    throw new DomainError("证书记录不存在", "CERTIFICATE_RECORD_NOT_FOUND");
  }
  if (certificateRecord.studentId !== student.id) {
    throw new DomainError("只能删除自己的证书记录", "STUDENT_CERTIFICATE_FORBIDDEN");
  }

  next.certificateRecords = certificateRecordsOf(next).filter((record) => record.id !== certificateRecordId);

  return {
    state: next
  };
}

export function listCertificateCollection(state, collectorUserId) {
  findCertificateCollectorByUserId(state, collectorUserId);
  return certificateRecordsOf(state).map((record) => presentCertificateRecord(state, record));
}

export function listCertificateCollectionByCompetition(state, collectorUserId) {
  findCertificateCollectorByUserId(state, collectorUserId);
  const groups = new Map();
  for (const record of certificateRecordsOf(state)) {
    const presented = presentCertificateRecord(state, record);
    if (!groups.has(record.competitionId)) {
      groups.set(record.competitionId, {
        competitionId: record.competitionId,
        competitionTitle: presented.competitionTitle,
        archiveName: `${sanitizeFileNameSegment(presented.competitionTitle)}-证书合集.zip`,
        records: []
      });
    }
    groups.get(record.competitionId).records.push(presented);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    records: withArchiveFileNames(group.records)
  }));
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

export function listRegisteredUsers(state, adminUserId) {
  findAdminByUserId(state, adminUserId);
  return state.users.map(publicUser).map((user) => ({
    ...user,
    roleLabel: roleLabel(user.role)
  }));
}

export function blockUser(state, adminUserId, userId) {
  findAdminByUserId(state, adminUserId);
  if (adminUserId === userId) {
    throw new DomainError("管理员不能封禁自己", "ADMIN_SELF_BLOCK_FORBIDDEN");
  }

  const next = cloneState(state);
  const user = next.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new DomainError("用户不存在", "USER_NOT_FOUND");
  }

  user.status = "封禁";

  return {
    state: next,
    user: publicUser(user)
  };
}

export function unblockUser(state, adminUserId, userId) {
  findAdminByUserId(state, adminUserId);
  const next = cloneState(state);
  const user = next.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new DomainError("用户不存在", "USER_NOT_FOUND");
  }

  user.status = "正常";

  return {
    state: next,
    user: publicUser(user)
  };
}

export function deleteUser(state, adminUserId, userId) {
  findAdminByUserId(state, adminUserId);
  if (adminUserId === userId) {
    throw new DomainError("管理员不能删除自己", "ADMIN_SELF_DELETE_FORBIDDEN");
  }

  const next = cloneState(state);
  const user = next.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new DomainError("用户不存在", "USER_NOT_FOUND");
  }

  cascadeDeleteUserProfile(next, user);
  next.users = next.users.filter((candidate) => candidate.id !== userId);

  return {
    state: next
  };
}

export function getDatabaseSnapshot(state, adminUserId) {
  findAdminByUserId(state, adminUserId);
  return {
    tables: {
      users: state.users.map(publicUser),
      students: state.students,
      mentors: state.mentors,
      certificateCollectors: state.certificateCollectors ?? [],
      admins: state.admins ?? [],
      competitions: state.competitions,
      researchProjects: state.researchProjects,
      teamRecruits: state.teamRecruits,
      applications: state.applications,
      certificateRecords: certificateRecordsOf(state),
      usageEvents: usageEventsOf(state),
      feedbackEntries: feedbackEntriesOf(state)
    }
  };
}

export function getAdminDatabaseView(state, adminUserId) {
  findAdminByUserId(state, adminUserId);
  const definitions = [
    {
      name: "users",
      label: "注册用户",
      records: state.users.map((user) =>
        readableRecord(user.id, user.name, `${roleLabel(user.role)} · ${user.email}`, [
          ["身份", roleLabel(user.role)],
          ["邮箱", user.email],
          ["状态", user.status]
        ])
      )
    },
    {
      name: "competitions",
      label: "竞赛",
      records: state.competitions.map((competition) =>
        readableRecord(competition.id, competition.title, `${competition.level} · ${competition.qqGroup}`, [
          ["级别", competition.level],
          ["时间", `${competition.startDate} 至 ${competition.endDate}`],
          ["官网", competition.officialUrl],
          ["交流群", competition.qqGroup]
        ], true)
      )
    },
    {
      name: "researchProjects",
      label: "科研项目",
      records: state.researchProjects.map((project) =>
        readableRecord(project.id, project.title, `${project.direction} · ${project.status}`, [
          ["方向", project.direction],
          ["技术栈", project.techStack.join(" / ")],
          ["交流群", project.qqGroup],
          ["状态", project.status]
        ], true)
      )
    },
    {
      name: "teamRecruits",
      label: "组队招募",
      records: state.teamRecruits.map((recruit) =>
        readableRecord(recruit.id, recruit.title, `${recruit.status} · ${recruit.contact}`, [
          ["竞赛ID", recruit.competitionId],
          ["技能", recruit.skills.join(" / ")],
          ["联系方式", recruit.contact],
          ["状态", recruit.status]
        ], true)
      )
    },
    {
      name: "applications",
      label: "申请",
      records: state.applications.map((application) =>
        readableRecord(application.id, application.status, `${application.targetType} · ${application.targetId}`, [
          ["目标", `${application.targetType}:${application.targetId}`],
          ["学生ID", application.studentId],
          ["陈述", application.statement],
          ["状态", application.status]
        ], true)
      )
    },
    {
      name: "certificateRecords",
      label: "证书记录",
      records: certificateRecordsOf(state).map((record) => {
        const presented = presentCertificateRecord(state, record);
        return readableRecord(record.id, presented.awardSummary, presented.uploaderName, [
          ["上传者", presented.uploaderName],
          ["获奖时间", record.awardDate],
          ["文件", presented.fileSummary],
          ["图片预览", presented.hasPreview ? "有" : "无"]
        ], true);
      })
    },
    {
      name: "usageEvents",
      label: "使用记录",
      records: usageEventsOf(state).map((event) => {
        const presented = presentUsageEvent(state, event);
        return readableRecord(event.id, presented.actionLabel, presented.targetSummary, [
          ["用户", presented.userSummary],
          ["目标", presented.targetSummary],
          ["动作", presented.actionLabel],
          ["时间", event.occurredAt]
        ], true);
      })
    },
    {
      name: "feedbackEntries",
      label: "使用反馈",
      records: feedbackEntriesOf(state).map((feedback) =>
        readableRecord(feedback.id, feedback.painPoint, `${feedback.rating}/5 · ${feedback.contact}`, [
          ["联系方式", feedback.contact],
          ["评分", `${feedback.rating}/5`],
          ["内容", feedback.message],
          ["时间", feedback.submittedAt]
        ], true)
      )
    }
  ];

  return { tables: definitions };
}

export function deleteDatabaseRecord(state, adminUserId, payload) {
  findAdminByUserId(state, adminUserId);
  const table = requiredText(payload.table, "数据表");
  const id = requiredText(payload.id, "记录ID");
  const deletableTables = new Set([
    "competitions",
    "researchProjects",
    "teamRecruits",
    "applications",
    "certificateRecords",
    "usageEvents",
    "feedbackEntries"
  ]);
  if (!deletableTables.has(table)) {
    throw new DomainError("该数据表不允许在 MVP 中删除", "TABLE_NOT_DELETABLE");
  }

  const next = cloneState(state);
  next[table] = (next[table] ?? []).filter((record) => record.id !== id);
  if (table === "competitions") {
    next.teamRecruits = next.teamRecruits.filter((record) => record.competitionId !== id);
    next.certificateRecords = certificateRecordsOf(next).filter((record) => record.competitionId !== id);
  }
  if (table === "researchProjects") {
    next.applications = next.applications.filter(
      (record) => !(record.targetType === "research" && record.targetId === id)
    );
  }
  return {
    state: next
  };
}

function cloneState(state) {
  return globalThis.structuredClone
    ? globalThis.structuredClone(state)
    : JSON.parse(JSON.stringify(state));
}

function findAdminByUserId(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  const admin = (state.admins ?? []).find((candidate) => candidate.userId === userId);
  if (!user || !admin || user.role !== "admin") {
    throw new DomainError("只有管理员可以执行该操作", "ADMIN_REQUIRED");
  }
  return admin;
}

function findResearchProjectMaintainer(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (user?.role === "admin") {
    return {
      role: "admin",
      admin: findAdminByUserId(state, userId)
    };
  }
  if (user?.role === "mentor") {
    return {
      role: "mentor",
      mentor: findMentorByUserId(state, userId)
    };
  }
  throw new DomainError("只有管理员或导师可以维护科研项目", "RESEARCH_MAINTAINER_REQUIRED");
}

function findMentorByUserId(state, userId) {
  const user = state.users.find((candidate) => candidate.id === userId);
  const mentor = state.mentors.find((candidate) => candidate.userId === userId);
  if (!user || !mentor || user.role !== "mentor") {
    throw new DomainError("只有导师可以执行该操作", "MENTOR_REQUIRED");
  }
  return mentor;
}

function resolveMentorId(state, mentorIdentifier) {
  const mentor = state.mentors.find(
    (candidate) => candidate.id === mentorIdentifier || candidate.userId === mentorIdentifier
  );
  if (!mentor) {
    throw new DomainError("导师不存在", "MENTOR_NOT_FOUND");
  }
  return mentor.id;
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

function cascadeDeleteUserProfile(state, user) {
  if (user.role === "student") {
    const student = state.students.find((candidate) => candidate.userId === user.id);
    state.students = state.students.filter((candidate) => candidate.userId !== user.id);
    if (student) {
      state.teamRecruits = state.teamRecruits.filter((recruit) => recruit.studentId !== student.id);
      state.applications = state.applications.filter((application) => application.studentId !== student.id);
      state.certificateRecords = certificateRecordsOf(state).filter((record) => record.studentId !== student.id);
    }
    return;
  }

  if (user.role === "mentor") {
    const mentor = state.mentors.find((candidate) => candidate.userId === user.id);
    state.mentors = state.mentors.filter((candidate) => candidate.userId !== user.id);
    if (mentor) {
      const researchIds = new Set(
        state.researchProjects
          .filter((project) => project.mentorId === mentor.id)
          .map((project) => project.id)
      );
      state.researchProjects = state.researchProjects.filter((project) => project.mentorId !== mentor.id);
      state.applications = state.applications.filter(
        (application) => !(application.targetType === "research" && researchIds.has(application.targetId))
      );
    }
    return;
  }

  if (user.role === "certificate_collector") {
    state.certificateCollectors = (state.certificateCollectors ?? []).filter(
      (collector) => collector.userId !== user.id
    );
    return;
  }

  if (user.role === "admin") {
    state.admins = (state.admins ?? []).filter((admin) => admin.userId !== user.id);
  }
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

function isImageFile(fileName) {
  return /\.(jpg|jpeg|png)$/i.test(fileName);
}

function fileExtension(fileName) {
  const extension = `${fileName ?? ""}`.split(".").pop()?.trim();
  return extension ? extension.toLowerCase() : "dat";
}

function roleLabel(role) {
  const labels = {
    student: "学生",
    mentor: "导师",
    certificate_collector: "证书收集者",
    admin: "管理员"
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

function normalizeReviewDecision(decision) {
  const normalized = `${decision ?? ""}`.trim();
  const decisions = {
    approve: "approve",
    approved: "approve",
    pass: "approve",
    通过: "approve",
    reject: "reject",
    rejected: "reject",
    fail: "reject",
    不通过: "reject"
  };
  if (!decisions[normalized]) {
    throw new DomainError("审批结果只能是通过或不通过", "INVALID_REVIEW_DECISION");
  }
  return decisions[normalized];
}

function nextId(prefix, collection) {
  const maxNumber = (collection ?? []).reduce((max, record) => {
    const id = `${record.id ?? ""}`;
    if (!id.startsWith(`${prefix}_`)) {
      return max;
    }
    const number = Number(id.slice(prefix.length + 1));
    return Number.isInteger(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}_${maxNumber + 1}`;
}

function readableRecord(id, title, summary, fields, canDelete = false) {
  return {
    id,
    title,
    summary,
    fields: fields.map(([label, value]) => ({ label, value })),
    canDelete
  };
}

function withArchiveFileNames(records) {
  const usedNames = new Map();
  return records.map((record) => {
    const stem = sanitizeFileNameSegment(record.uploaderName);
    const extension = fileExtension(record.fileName);
    const currentCount = usedNames.get(stem) ?? 0;
    usedNames.set(stem, currentCount + 1);
    const suffix = currentCount === 0 ? "" : `-${currentCount + 1}`;
    return {
      ...record,
      archiveFileName: `${stem}${suffix}.${extension}`
    };
  });
}

function sanitizeFileNameSegment(value) {
  return `${value ?? ""}`
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    || "未命名";
}

function presentUsageEvent(state, usageEvent) {
  const user = usageEvent.userId
    ? state.users.find((candidate) => candidate.id === usageEvent.userId)
    : null;
  return {
    ...usageEvent,
    actionLabel: usageActionLabel(usageEvent.action),
    targetSummary: usageTargetSummary(state, usageEvent.target),
    userSummary: user ? `${user.name} · ${roleLabel(user.role)}` : "匿名用户"
  };
}

function usageActionLabel(action) {
  const labels = {
    view_opportunity: "浏览机会",
    filter_opportunities: "筛选机会",
    paginate_opportunities: "切换机会分页",
    publish_team_recruit: "发布组队招募",
    stop_team_recruit: "结束组队招募",
    resume_team_recruit: "重新开启组队招募",
    delete_team_recruit: "删除组队招募",
    apply_research: "提交科研申请",
    delete_research_application: "删除科研申请",
    upload_certificate_record: "上传证书记录",
    delete_certificate_record: "删除证书记录",
    download_certificate_record: "下载证书记录",
    export_certificate_archive: "导出证书合集",
    submit_feedback: "提交反馈",
    create_competition: "新增竞赛",
    create_research_project: "新增科研项目",
    delete_research_project: "删除科研项目",
    review_research_application: "审批科研申请",
    block_user: "封禁用户",
    unblock_user: "解除封禁用户",
    delete_user: "删除用户",
    delete_database_record: "删除数据库记录"
  };
  return labels[action] ?? action;
}

function usageTargetSummary(state, target) {
  const normalizedTarget = `${target ?? ""}`.trim();
  if (!normalizedTarget) {
    return "无目标";
  }

  const filterLabels = {
    all: "全部机会",
    competition: "竞赛机会",
    research: "科研项目机会"
  };
  if (filterLabels[normalizedTarget]) {
    return filterLabels[normalizedTarget];
  }

  const competition = state.competitions.find((item) => item.id === normalizedTarget);
  if (competition) {
    return competition.title;
  }

  const research = state.researchProjects.find((project) => project.id === normalizedTarget);
  if (research) {
    return research.title;
  }

  const recruit = state.teamRecruits.find((item) => item.id === normalizedTarget);
  if (recruit) {
    return recruit.title;
  }

  const application = state.applications.find((item) => item.id === normalizedTarget);
  if (application) {
    return application.researchTitle ?? usageApplicationTargetSummary(state, application);
  }

  const certificateRecord = certificateRecordsOf(state).find((item) => item.id === normalizedTarget);
  if (certificateRecord) {
    return presentCertificateRecord(state, certificateRecord).awardSummary;
  }

  const feedback = feedbackEntriesOf(state).find((item) => item.id === normalizedTarget);
  if (feedback) {
    return feedback.painPoint;
  }

  if (normalizedTarget.includes(":")) {
    const [table, id] = normalizedTarget.split(":");
    return `${databaseTableLabel(table)} · ${usageTargetSummary(state, id)}`;
  }

  return normalizedTarget;
}

function usageApplicationTargetSummary(state, application) {
  if (application.targetType === "research") {
    const research = state.researchProjects.find((project) => project.id === application.targetId);
    return research ? `科研申请：${research.title}` : `科研申请：${application.targetId}`;
  }
  return `${application.targetType}:${application.targetId}`;
}

function databaseTableLabel(table) {
  const labels = {
    competitions: "竞赛",
    researchProjects: "科研项目",
    teamRecruits: "组队招募",
    applications: "申请",
    certificateRecords: "证书记录",
    usageEvents: "使用记录",
    feedbackEntries: "使用反馈"
  };
  return labels[table] ?? table;
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
    fileSummary: `${certificateRecord.fileName} · ${formatBytes(certificateRecord.fileSizeBytes)}`,
    downloadUrl: certificateRecord.downloadUrl ?? certificateRecord.previewUrl ?? "",
    archiveFileName: `${sanitizeFileNameSegment(user?.name ?? "未知上传者")}.${fileExtension(certificateRecord.fileName)}`
  };
}

function presentResearchProject(state, project) {
  const mentor = state.mentors.find((candidate) => candidate.id === project.mentorId);
  const user = state.users.find((candidate) => candidate.id === mentor?.userId);
  return {
    ...project,
    mentorName: user?.name ?? mentor?.name ?? "未知导师"
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
    researchTitle: research?.title,
    mentorContact: application.mentorContact ?? "",
    mentorFeedback: application.mentorFeedback ?? ""
  };
}

function presentTeamRecruit(state, recruit) {
  const student = state.students.find((candidate) => candidate.id === recruit.studentId);
  const user = state.users.find((candidate) => candidate.id === student?.userId);
  const competition = state.competitions.find((candidate) => candidate.id === recruit.competitionId);
  return {
    ...recruit,
    status: normalizeTeamRecruitStatus(recruit.status),
    publisherName: user?.name ?? "未知学生",
    competitionTitle: competition?.title ?? "未知竞赛"
  };
}

function isOpenTeamRecruit(recruit) {
  return normalizeTeamRecruitStatus(recruit.status) === "招募中";
}

function normalizeTeamRecruitStatus(status) {
  if (status === "有效") {
    return "招募中";
  }
  if (status === "不招了") {
    return "已结束";
  }
  return status ?? "招募中";
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
  const roles = new Set(["student", "mentor", "certificate_collector", "admin"]);
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
