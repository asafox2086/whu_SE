import {
  applyToResearchProject,
  createCompetition,
  createInitialState,
  createResearchProject,
  createTeamRecruit,
  deleteResearchProject,
  deleteDatabaseRecord,
  DomainError,
  getAdminDatabaseView,
  getCompetitionDetail,
  listCertificateCollection,
  listCertificateRecords,
  listFeedbackEntries,
  listOpportunities,
  listRegisteredUsers,
  listResearchApplicationsForMentor,
  listResearchApplicationsForStudent,
  listResearchProjectsForMentor,
  login,
  recordUsage,
  registerUser,
  reviewResearchApplication,
  submitFeedback,
  uploadCertificateRecord
} from "./domain.mjs";

const storageKey = "xinggui_mvp_state_v1";
const sessionKey = "xinggui_mvp_session_v1";

let state = loadState();
let session = loadSession();
let selectedOpportunityType = "all";
let serverStorageAvailable = false;
let pendingStateSave = Promise.resolve();

const selectors = {
  userBadge: document.querySelector("[data-user-badge]"),
  logoutButton: document.querySelector("[data-logout]"),
  authForm: document.querySelector("[data-auth-form]"),
  authMessage: document.querySelector("[data-auth-message]"),
  rolePanels: document.querySelectorAll("[data-role-panel]"),
  opportunityFilters: document.querySelector("[data-opportunity-filters]"),
  opportunityList: document.querySelector("[data-opportunity-list]"),
  detailPanel: document.querySelector("[data-detail-panel]"),
  recruitForm: document.querySelector("[data-recruit-form]"),
  researchApplyForm: document.querySelector("[data-research-apply-form]"),
  studentApplications: document.querySelector("[data-student-applications]"),
  certificateForm: document.querySelector("[data-certificate-form]"),
  certificateList: document.querySelector("[data-certificate-list]"),
  certificateCollection: document.querySelector("[data-certificate-collection]"),
  adminUsers: document.querySelector("[data-admin-users]"),
  adminDatabase: document.querySelector("[data-admin-database]"),
  adminCompetitionForm: document.querySelector("[data-admin-competition-form]"),
  adminResearchForm: document.querySelector("[data-admin-research-form]"),
  mentorResearchForm: document.querySelector("[data-mentor-research-form]"),
  mentorProjects: document.querySelector("[data-mentor-projects]"),
  mentorApplications: document.querySelector("[data-mentor-applications]"),
  feedbackForm: document.querySelector("[data-feedback-form]"),
  feedbackList: document.querySelector("[data-feedback-list]"),
  toast: document.querySelector("[data-toast]")
};

selectors.authForm.addEventListener("submit", handleAuthSubmit);
selectors.logoutButton.addEventListener("click", handleLogout);
selectors.opportunityFilters.addEventListener("click", handleOpportunityFilter);
selectors.opportunityList.addEventListener("click", handleOpportunityClick);
selectors.recruitForm.addEventListener("submit", handleRecruitSubmit);
selectors.researchApplyForm.addEventListener("submit", handleResearchApplySubmit);
selectors.certificateForm.addEventListener("submit", handleCertificateSubmit);
selectors.feedbackForm.addEventListener("submit", handleFeedbackSubmit);
selectors.adminDatabase.addEventListener("click", handleAdminDatabaseClick);
selectors.adminCompetitionForm.addEventListener("submit", handleAdminCompetitionSubmit);
selectors.adminResearchForm.addEventListener("submit", handleAdminResearchSubmit);
selectors.mentorResearchForm.addEventListener("submit", handleMentorResearchSubmit);
selectors.mentorProjects.addEventListener("click", handleMentorProjectsClick);
selectors.mentorApplications.addEventListener("submit", handleMentorApplicationReviewSubmit);

render();
hydrateStateFromServer();

function handleAuthSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const mode = event.submitter?.value ?? "login";
  const credentials = {
    role: form.get("role"),
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
    major: form.get("major"),
    githubUrl: form.get("githubUrl"),
    department: form.get("department")
  };

  try {
    if (mode === "register") {
      const registered = registerUser(state, credentials);
      state = registered.state;
      session = login(state, credentials);
      showToast("注册成功，已进入平台");
    } else {
      session = login(state, credentials);
      showToast("登录成功");
    }
    saveAll();
    render();
  } catch (error) {
    showInlineMessage(selectors.authMessage, error);
  }
}

function handleLogout() {
  session = null;
  localStorage.removeItem(sessionKey);
  showToast("已切换为未登录状态");
  render();
}

function handleOpportunityFilter(event) {
  const button = event.target.closest("button[data-type]");
  if (!button) {
    return;
  }
  selectedOpportunityType = button.dataset.type;
  trackUsage("filter_opportunities", selectedOpportunityType);
  renderOpportunities();
}

function handleOpportunityClick(event) {
  const button = event.target.closest("button[data-opportunity-id]");
  if (!button) {
    return;
  }
  const { opportunityId, opportunityType } = button.dataset;
  trackUsage("view_opportunity", opportunityId);
  renderOpportunityDetail(opportunityType, opportunityId);
}

function handleRecruitSubmit(event) {
  event.preventDefault();

  try {
    requireSession();
    const form = new FormData(event.currentTarget);
    const created = createTeamRecruit(state, {
      competitionId: form.get("competitionId"),
      studentUserId: session.user.id,
      title: form.get("title"),
      skills: `${form.get("skills")}`.split(/[，,]/),
      contact: form.get("contact")
    });
    state = created.state;
    trackUsage("publish_team_recruit", created.recruit.id);
    saveState();
    event.currentTarget.reset();
    showToast("组队招募已发布");
    render();
    renderOpportunityDetail("competition", form.get("competitionId"));
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleResearchApplySubmit(event) {
  event.preventDefault();

  try {
    requireSession();
    const form = new FormData(event.currentTarget);
    const applied = applyToResearchProject(state, {
      researchId: form.get("researchId"),
      studentUserId: session.user.id,
      statement: form.get("statement")
    });
    state = applied.state;
    trackUsage("apply_research", applied.application.id);
    saveState();
    event.currentTarget.reset();
    showToast("申请已提交，等待导师审核");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleCertificateSubmit(event) {
  event.preventDefault();
  const formElement = event.currentTarget;

  try {
    requireSession();
    const form = new FormData(formElement);
    const file = formElement.querySelector("input[type=file]").files[0];
    const fileDataUrl = await readFileDataUrl(file);
    const uploaded = uploadCertificateRecord(state, {
      studentUserId: session.user.id,
      competitionId: form.get("competitionId"),
      awardLevel: form.get("awardLevel"),
      awardDate: form.get("awardDate"),
      fileName: file?.name,
      fileSizeBytes: file?.size,
      fileDataUrl
    });
    state = uploaded.state;
    trackUsage("upload_certificate_record", uploaded.certificateRecord.id);
    saveState();
    formElement.reset();
    showToast("证书记录已保存");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleAdminDatabaseClick(event) {
  const button = event.target.closest("button[data-delete-table]");
  if (!button) {
    return;
  }
  try {
    requireSession();
    const deleted = deleteDatabaseRecord(state, session.user.id, {
      table: button.dataset.deleteTable,
      id: button.dataset.deleteId
    });
    state = deleted.state;
    trackUsage("delete_database_record", `${button.dataset.deleteTable}:${button.dataset.deleteId}`);
    saveState();
    showToast("记录已删除");
    renderAdmin();
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleAdminCompetitionSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    requireSession();
    const created = createCompetition(state, session.user.id, {
      title: form.get("title"),
      level: form.get("level"),
      officialUrl: form.get("officialUrl"),
      qqGroup: form.get("qqGroup"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
      description: form.get("description")
    });
    state = created.state;
    trackUsage("create_competition", created.competition.id);
    saveState();
    event.currentTarget.reset();
    showToast("竞赛已新增");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleAdminResearchSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    requireSession();
    const created = createResearchProject(state, session.user.id, {
      title: form.get("title"),
      direction: form.get("direction"),
      techStack: form.get("techStack"),
      qqGroup: form.get("qqGroup"),
      description: form.get("description"),
      status: form.get("status")
    });
    state = created.state;
    trackUsage("create_research_project", created.researchProject.id);
    saveState();
    event.currentTarget.reset();
    showToast("科研项目已新增");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleMentorResearchSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    requireSession();
    const created = createResearchProject(state, session.user.id, {
      title: form.get("title"),
      direction: form.get("direction"),
      techStack: form.get("techStack"),
      qqGroup: form.get("qqGroup"),
      description: form.get("description"),
      status: form.get("status")
    });
    state = created.state;
    trackUsage("create_research_project", created.researchProject.id);
    saveState();
    event.currentTarget.reset();
    showToast("科研项目已发布");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleMentorProjectsClick(event) {
  const button = event.target.closest("button[data-delete-research-id]");
  if (!button) {
    return;
  }

  try {
    requireSession();
    const deleted = deleteResearchProject(state, session.user.id, button.dataset.deleteResearchId);
    state = deleted.state;
    trackUsage("delete_research_project", button.dataset.deleteResearchId);
    saveState();
    showToast("科研项目已删除");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleMentorApplicationReviewSubmit(event) {
  event.preventDefault();
  const formElement = event.target.closest("form[data-application-review-form]");
  if (!formElement) {
    return;
  }
  const form = new FormData(formElement);
  const decision = event.submitter?.value;

  try {
    requireSession();
    const reviewed = reviewResearchApplication(state, session.user.id, {
      applicationId: formElement.dataset.applicationId,
      decision,
      contact: form.get("contact"),
      feedback: form.get("feedback")
    });
    state = reviewed.state;
    trackUsage("review_research_application", reviewed.application.id);
    saveState();
    showToast(reviewed.application.status === "已通过" ? "申请已通过" : "申请已标记未通过");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleFeedbackSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const submitted = submitFeedback(state, {
      userId: session?.user.id,
      contact: form.get("contact"),
      painPoint: form.get("painPoint"),
      message: form.get("message"),
      rating: form.get("rating")
    });
    state = submitted.state;
    trackUsage("submit_feedback", submitted.feedback.id);
    saveState();
    event.currentTarget.reset();
    showToast("反馈已保存");
    renderFeedback();
  } catch (error) {
    showToast(error.message, true);
  }
}

function render() {
  renderAuth();
  renderOpportunities();
  renderForms();
  renderStudentApplications();
  renderCertificates();
  renderCertificateCollection();
  renderAdmin();
  renderMentorProjects();
  renderMentorApplications();
  renderFeedback();
}

function renderAuth() {
  selectors.userBadge.textContent = session
    ? `${session.user.name} · ${roleLabel(session.user.role)}`
    : "未登录";
  selectors.logoutButton.hidden = !session;
  selectors.rolePanels.forEach((panel) => {
    panel.hidden = !session || panel.dataset.rolePanel !== session.user.role;
  });
  showInlineMessage(selectors.authMessage, null);
}

function renderOpportunities() {
  const filter = selectedOpportunityType === "all"
    ? {}
    : { type: selectedOpportunityType };
  const opportunities = listOpportunities(state, filter);

  selectors.opportunityFilters.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === selectedOpportunityType);
  });

  selectors.opportunityList.innerHTML = opportunities
    .map(
      (opportunity) => `
        <article class="item-card">
          <div>
            <span class="eyebrow">${opportunity.type === "competition" ? "竞赛" : "科研项目"}</span>
            <h3>${escapeHtml(opportunity.title)}</h3>
            <p>${escapeHtml(opportunity.description)}</p>
          </div>
          <div class="tag-row">
            ${opportunity.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          </div>
          <footer>
            <small>${escapeHtml(opportunity.subtitle)}</small>
            <button data-opportunity-id="${opportunity.id}" data-opportunity-type="${opportunity.type}">查看</button>
          </footer>
        </article>
      `
    )
    .join("");
}

function renderOpportunityDetail(type, id) {
  if (type === "competition") {
    const detail = getCompetitionDetail(state, id);
    selectors.detailPanel.innerHTML = `
      <span class="eyebrow">竞赛详情</span>
      <h2>${escapeHtml(detail.title)}</h2>
      <p>${escapeHtml(detail.description)}</p>
      <dl class="meta-grid">
        <div><dt>级别</dt><dd>${escapeHtml(detail.level)}</dd></div>
        <div><dt>时间</dt><dd>${escapeHtml(detail.startDate)} 至 ${escapeHtml(detail.endDate)}</dd></div>
        <div><dt>交流群</dt><dd>${escapeHtml(detail.qqGroup)}</dd></div>
      </dl>
      <h3>组队招募</h3>
      ${renderRecruitList(detail.teamRecruits)}
    `;
    selectors.recruitForm.elements.competitionId.value = id;
    return;
  }

  const research = state.researchProjects.find((project) => project.id === id);
  selectors.detailPanel.innerHTML = `
    <span class="eyebrow">科研项目</span>
    <h2>${escapeHtml(research.title)}</h2>
    <p>${escapeHtml(research.description)}</p>
    <dl class="meta-grid">
      <div><dt>方向</dt><dd>${escapeHtml(research.direction)}</dd></div>
      <div><dt>技术栈</dt><dd>${research.techStack.map(escapeHtml).join(" / ")}</dd></div>
      <div><dt>状态</dt><dd>${escapeHtml(research.status)}</dd></div>
    </dl>
  `;
  selectors.researchApplyForm.elements.researchId.value = id;
}

function renderRecruitList(recruits) {
  if (recruits.length === 0) {
    return `<p class="empty">暂无招募，登录后可发布第一条。</p>`;
  }
  return recruits
    .map(
      (recruit) => `
        <section class="mini-card">
          <strong>${escapeHtml(recruit.title)}</strong>
          <span>${escapeHtml(recruit.publisherName)} · ${escapeHtml(recruit.contact)}</span>
          <small>${recruit.skills.map(escapeHtml).join(" / ")}</small>
        </section>
      `
    )
    .join("");
}

function renderForms() {
  const competitionOptions = state.competitions
    .map((competition) => `<option value="${competition.id}">${escapeHtml(competition.title)}</option>`)
    .join("");
  const researchOptions = state.researchProjects
    .filter((project) => project.status === "招募中")
    .map((project) => `<option value="${project.id}">${escapeHtml(project.title)}</option>`)
    .join("");

  selectors.recruitForm.elements.competitionId.innerHTML = competitionOptions;
  selectors.researchApplyForm.elements.researchId.innerHTML = researchOptions;
  selectors.certificateForm.elements.competitionId.innerHTML = competitionOptions;
}

function renderStudentApplications() {
  if (!session || session.user.role !== "student") {
    selectors.studentApplications.innerHTML = `<p class="empty">登录后显示你的科研申请结果。</p>`;
    return;
  }

  const applications = listResearchApplicationsForStudent(state, session.user.id);
  selectors.studentApplications.innerHTML = applications.length === 0
    ? `<p class="empty">还没有科研申请记录。</p>`
    : applications
        .map(
          (application) => `
            <section class="mini-card">
              <strong>${escapeHtml(application.researchTitle)} · ${escapeHtml(application.status)}</strong>
              <span>${escapeHtml(application.statement)}</span>
              ${application.status === "已通过"
                ? `<small>后续联系：${escapeHtml(application.mentorContact)}</small>`
                : ""}
              ${application.status === "未通过"
                ? `<small>导师反馈：${escapeHtml(application.mentorFeedback)}</small>`
                : ""}
              ${application.status === "待审核"
                ? `<small>导师暂未审批，请稍后查看。</small>`
                : ""}
            </section>
          `
        )
        .join("");
}

function renderCertificates() {
  if (!session || session.user.role !== "student") {
    selectors.certificateList.innerHTML = `<p class="empty">登录后显示个人证书记录。</p>`;
    return;
  }

  const records = listCertificateRecords(state, session.user.id);
  selectors.certificateList.innerHTML = records.length === 0
    ? `<p class="empty">还没有证书记录。</p>`
    : records
        .map(
          (record) => `
            <section class="mini-card">
              ${renderCertificatePreview(record)}
              <strong>${escapeHtml(record.competitionTitle)}</strong>
              <span>${escapeHtml(record.awardLevel)} · ${escapeHtml(record.awardDate)}</span>
              <small>${escapeHtml(record.fileSummary)}</small>
            </section>
          `
        )
        .join("");
}

function renderCertificateCollection() {
  if (!session || session.user.role !== "certificate_collector") {
    selectors.certificateCollection.innerHTML = `<p class="empty">切换为证书收集者后显示汇总。</p>`;
    return;
  }

  const records = listCertificateCollection(state, session.user.id);
  selectors.certificateCollection.innerHTML = records.length === 0
    ? `<p class="empty">还没有证书记录。</p>`
    : records
        .map(
          (record) => `
            <section class="mini-card">
              ${renderCertificatePreview(record)}
              <strong>${escapeHtml(record.awardSummary)}</strong>
              <span>${escapeHtml(record.uploaderName)} · ${escapeHtml(record.awardDate)}</span>
              <small>${escapeHtml(record.fileSummary)}</small>
            </section>
          `
        )
        .join("");
}

function renderAdmin() {
  if (!session || session.user.role !== "admin") {
    selectors.adminUsers.innerHTML = `<p class="empty">切换为管理员后显示注册用户。</p>`;
    selectors.adminDatabase.innerHTML = "";
    return;
  }

  const users = listRegisteredUsers(state, session.user.id);
  selectors.adminUsers.innerHTML = users
    .map(
      (user) => `
        <section class="mini-card">
          <strong>${escapeHtml(user.name)} · ${escapeHtml(user.roleLabel)}</strong>
          <span>${escapeHtml(user.email)} · ${escapeHtml(user.status)}</span>
          <small>${escapeHtml(user.id)}</small>
        </section>
      `
    )
    .join("");

  const view = getAdminDatabaseView(state, session.user.id);
  selectors.adminDatabase.innerHTML = view.tables
    .map((table) => {
      const rowList = table.records.length === 0
        ? `<p class="empty">空表</p>`
        : table.records
            .map(
              (record) => `
                <section class="db-row">
                  <div>
                    <strong>${escapeHtml(record.title)}</strong>
                    <span>${escapeHtml(record.summary)}</span>
                    <dl class="record-fields">
                      ${record.fields
                        .map(
                          (field) => `
                            <div>
                              <dt>${escapeHtml(field.label)}</dt>
                              <dd>${escapeHtml(field.value)}</dd>
                            </div>
                          `
                        )
                        .join("")}
                    </dl>
                  </div>
                  ${record.canDelete
                    ? `<button class="secondary" data-delete-table="${table.name}" data-delete-id="${escapeHtml(record.id)}">删除</button>`
                    : ""}
                </section>
              `
            )
            .join("");
      return `
        <article class="db-card">
          <h3>${escapeHtml(table.label)} <span>${table.records.length}</span></h3>
          ${rowList}
        </article>
      `;
    })
    .join("");
}

function renderMentorApplications() {
  if (!session || session.user.role !== "mentor") {
    selectors.mentorApplications.innerHTML = `<p class="empty">切换为导师后显示申请队列。</p>`;
    return;
  }

  const applications = listResearchApplicationsForMentor(state, session.user.id);
  selectors.mentorApplications.innerHTML = applications.length === 0
    ? `<p class="empty">暂无科研项目申请。</p>`
    : applications
        .map(
          (application) => `
            <section class="mini-card">
              <strong>${escapeHtml(application.studentName)} 申请 ${escapeHtml(application.researchTitle)}</strong>
              <span>${escapeHtml(application.status)}</span>
              <small>${escapeHtml(application.statement)}</small>
              ${application.status === "待审核"
                ? `
                  <form class="review-form" data-application-review-form data-application-id="${escapeHtml(application.id)}">
                    <label>
                      通过后的联系方式
                      <input name="contact" placeholder="QQ群 / 邮箱 / 会议链接">
                    </label>
                    <label>
                      反馈
                      <textarea name="feedback" placeholder="通过说明或未通过原因"></textarea>
                    </label>
                    <div class="button-row">
                      <button name="decision" value="approve" type="submit">通过</button>
                      <button class="secondary" name="decision" value="reject" type="submit">不通过</button>
                    </div>
                  </form>
                `
                : `
                  <small>${application.mentorContact ? `后续联系：${escapeHtml(application.mentorContact)}` : ""}</small>
                  <small>${application.mentorFeedback ? `导师反馈：${escapeHtml(application.mentorFeedback)}` : ""}</small>
                `}
            </section>
          `
        )
        .join("");
}

function renderMentorProjects() {
  if (!session || session.user.role !== "mentor") {
    selectors.mentorProjects.innerHTML = `<p class="empty">切换为导师后显示你发布的科研项目。</p>`;
    return;
  }

  const projects = listResearchProjectsForMentor(state, session.user.id);
  selectors.mentorProjects.innerHTML = projects.length === 0
    ? `<p class="empty">还没有发布科研项目。</p>`
    : projects
        .map(
          (project) => `
            <section class="mini-card project-row">
              <div>
                <strong>${escapeHtml(project.title)}</strong>
                <span>${escapeHtml(project.direction)} · ${escapeHtml(project.status)} · QQ群 ${escapeHtml(project.qqGroup)}</span>
                <small>${project.techStack.map(escapeHtml).join(" / ")}</small>
              </div>
              <button class="secondary" data-delete-research-id="${escapeHtml(project.id)}">删除</button>
            </section>
          `
        )
        .join("");
}

function renderFeedback() {
  const entries = listFeedbackEntries(state);
  selectors.feedbackList.innerHTML = entries.length === 0
    ? `<p class="empty">暂无反馈记录。</p>`
    : entries
        .map(
          (entry) => `
            <section class="mini-card">
              <strong>${escapeHtml(entry.userName)} · ${escapeHtml(entry.roleLabel)} · ${entry.rating}/5</strong>
              <span>${escapeHtml(entry.painPoint)} · 使用 ${entry.usageCount} 次</span>
              <small>${escapeHtml(entry.message)}</small>
            </section>
          `
        )
        .join("");
}

function renderCertificatePreview(record) {
  if (record.hasPreview && record.previewUrl) {
    return `<img class="certificate-preview" src="${escapeHtml(record.previewUrl)}" alt="证书预览">`;
  }
  return `<div class="certificate-preview is-placeholder">暂无图片预览</div>`;
}

function loadState() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return createInitialState();
  }

  return normalizeStoredState(JSON.parse(stored));
}

async function hydrateStateFromServer() {
  try {
    const response = await fetch("/api/state", {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    serverStorageAvailable = true;
    if (payload.source === "seed" && localStorage.getItem(storageKey)) {
      queuePersistState();
      return;
    }

    state = normalizeStoredState(payload.state);
    localStorage.setItem(storageKey, JSON.stringify(state));
    render();
  } catch {
    serverStorageAvailable = false;
  }
}

function normalizeStoredState(parsed) {
  const defaults = createInitialState();
  return {
    ...defaults,
    ...parsed,
    admins: parsed.admins ?? [],
    certificateCollectors: parsed.certificateCollectors ?? [],
    usageEvents: parsed.usageEvents ?? [],
    feedbackEntries: parsed.feedbackEntries ?? []
  };
}

function loadSession() {
  const stored = localStorage.getItem(sessionKey);
  return stored ? JSON.parse(stored) : null;
}

function saveAll() {
  saveState();
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  queuePersistState();
}

function queuePersistState() {
  if (!serverStorageAvailable) {
    return;
  }

  const snapshot = state;
  pendingStateSave = pendingStateSave
    .catch(() => {})
    .then(() => persistStateToServer(snapshot))
    .catch(() => {
      showToast("本地数据文件保存失败，已暂存在浏览器", true);
    });
}

async function persistStateToServer(snapshot) {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) {
    throw new Error("本地数据文件保存失败");
  }
}

function readFileDataUrl(file) {
  if (!file || !/^image\//.test(file.type)) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(`${reader.result ?? ""}`));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function trackUsage(action, target = "") {
  try {
    const recorded = recordUsage(state, {
      userId: session?.user.id,
      action,
      target
    });
    state = recorded.state;
  } catch {
    // Usage collection should never block the MVP workflow.
  }
}

function requireSession() {
  if (!session) {
    throw new DomainError("请先注册或登录", "LOGIN_REQUIRED");
  }
}

function showInlineMessage(element, error) {
  element.textContent = error ? error.message : "";
}

function showToast(message, isError = false) {
  selectors.toast.textContent = message;
  selectors.toast.classList.toggle("is-error", isError);
  selectors.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    selectors.toast.hidden = true;
  }, 2600);
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

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
