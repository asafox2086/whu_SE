import {
  applyToResearchProject,
  createInitialState,
  createTeamRecruit,
  DomainError,
  getCompetitionDetail,
  listCertificateRecords,
  listOpportunities,
  listResearchApplicationsForMentor,
  login,
  registerStudent,
  uploadCertificateRecord
} from "./domain.mjs";

const storageKey = "xinggui_mvp_state_v1";
const sessionKey = "xinggui_mvp_session_v1";

let state = loadState();
let session = loadSession();
let selectedOpportunityType = "all";

const selectors = {
  userBadge: document.querySelector("[data-user-badge]"),
  authForm: document.querySelector("[data-auth-form]"),
  authMessage: document.querySelector("[data-auth-message]"),
  opportunityFilters: document.querySelector("[data-opportunity-filters]"),
  opportunityList: document.querySelector("[data-opportunity-list]"),
  detailPanel: document.querySelector("[data-detail-panel]"),
  recruitForm: document.querySelector("[data-recruit-form]"),
  researchApplyForm: document.querySelector("[data-research-apply-form]"),
  certificateForm: document.querySelector("[data-certificate-form]"),
  certificateList: document.querySelector("[data-certificate-list]"),
  mentorApplications: document.querySelector("[data-mentor-applications]"),
  toast: document.querySelector("[data-toast]")
};

selectors.authForm.addEventListener("submit", handleAuthSubmit);
selectors.opportunityFilters.addEventListener("click", handleOpportunityFilter);
selectors.opportunityList.addEventListener("click", handleOpportunityClick);
selectors.recruitForm.addEventListener("submit", handleRecruitSubmit);
selectors.researchApplyForm.addEventListener("submit", handleResearchApplySubmit);
selectors.certificateForm.addEventListener("submit", handleCertificateSubmit);

render();

function handleAuthSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const mode = event.submitter?.value ?? "login";
  const credentials = {
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
    major: form.get("major"),
    githubUrl: form.get("githubUrl")
  };

  try {
    if (mode === "register") {
      const registered = registerStudent(state, credentials);
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

function handleOpportunityFilter(event) {
  const button = event.target.closest("button[data-type]");
  if (!button) {
    return;
  }
  selectedOpportunityType = button.dataset.type;
  renderOpportunities();
}

function handleOpportunityClick(event) {
  const button = event.target.closest("button[data-opportunity-id]");
  if (!button) {
    return;
  }
  const { opportunityId, opportunityType } = button.dataset;
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
    saveState();
    event.currentTarget.reset();
    showToast("申请已提交，等待导师审核");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleCertificateSubmit(event) {
  event.preventDefault();

  try {
    requireSession();
    const form = new FormData(event.currentTarget);
    const file = event.currentTarget.querySelector("input[type=file]").files[0];
    const uploaded = uploadCertificateRecord(state, {
      studentUserId: session.user.id,
      competitionId: form.get("competitionId"),
      awardLevel: form.get("awardLevel"),
      awardDate: form.get("awardDate"),
      fileName: file?.name,
      fileSizeBytes: file?.size
    });
    state = uploaded.state;
    saveState();
    event.currentTarget.reset();
    showToast("证书记录已保存");
    renderCertificates();
  } catch (error) {
    showToast(error.message, true);
  }
}

function render() {
  renderAuth();
  renderOpportunities();
  renderForms();
  renderCertificates();
  renderMentorApplications();
}

function renderAuth() {
  selectors.userBadge.textContent = session
    ? `${session.user.name} · 学生`
    : "未登录";
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

function renderCertificates() {
  if (!session) {
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
              <strong>${escapeHtml(record.competitionTitle)}</strong>
              <span>${escapeHtml(record.awardLevel)} · ${escapeHtml(record.awardDate)}</span>
              <small>${escapeHtml(record.fileName)}</small>
            </section>
          `
        )
        .join("");
}

function renderMentorApplications() {
  const applications = listResearchApplicationsForMentor(state, "mentor_1");
  selectors.mentorApplications.innerHTML = applications.length === 0
    ? `<p class="empty">暂无科研项目申请。</p>`
    : applications
        .map(
          (application) => `
            <section class="mini-card">
              <strong>${escapeHtml(application.studentName)} 申请 ${escapeHtml(application.researchTitle)}</strong>
              <span>${escapeHtml(application.status)}</span>
              <small>${escapeHtml(application.statement)}</small>
            </section>
          `
        )
        .join("");
}

function loadState() {
  const stored = localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : createInitialState();
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

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
