import {
  applyToResearchProject,
  createCompetition,
  createInitialState,
  createResearchProject,
  createTeamRecruit,
  blockUser,
  deleteCertificateRecord,
  deleteResearchApplication,
  deleteResearchProject,
  deleteTeamRecruit,
  deleteUser,
  deleteDatabaseRecord,
  DomainError,
  getAdminDatabaseView,
  getCompetitionDetail,
  listCertificateCollection,
  listCertificateCollectionByCompetition,
  listCertificateRecords,
  listFeedbackEntries,
  listOpportunities,
  listRegisteredUsers,
  listResearchApplicationsForMentor,
  listResearchApplicationsForStudent,
  listResearchProjectsForMentor,
  listTeamRecruitsForStudent,
  login,
  recordUsage,
  registerUser,
  reviewResearchApplication,
  resumeTeamRecruit,
  stopTeamRecruit,
  submitFeedback,
  unblockUser,
  uploadCertificateRecord
} from "./domain.mjs";

const storageKey = "xinggui_mvp_state_v1";
const sessionKey = "xinggui_mvp_session_v1";

let state = loadState();
let session = loadSession();
let selectedOpportunityType = "all";
let selectedOpportunityId = "";
let selectedOpportunityDetailType = "";
let selectedOpportunityPage = 1;
const opportunityPageSize = 6;
const listPageSize = 5;
let listPages = {};
let serverStorageAvailable = false;
let pendingStateSave = Promise.resolve();

const selectors = {
  userBadge: document.querySelector("[data-user-badge]"),
  logoutButton: document.querySelector("[data-logout]"),
  appContent: document.querySelector("[data-app-content]"),
  authPanel: document.querySelector("[data-auth-panel]"),
  appPanels: document.querySelectorAll("[data-app-panel]"),
  authForm: document.querySelector("[data-auth-form]"),
  authMessage: document.querySelector("[data-auth-message]"),
  rolePanels: document.querySelectorAll("[data-role-panel]"),
  opportunityFilters: document.querySelector("[data-opportunity-filters]"),
  opportunityList: document.querySelector("[data-opportunity-list]"),
  opportunityPagination: document.querySelector("[data-opportunity-pagination]"),
  detailPanel: document.querySelector("[data-detail-panel]"),
  recruitForm: document.querySelector("[data-recruit-form]"),
  studentRecruits: document.querySelector("[data-student-recruits]"),
  studentRecruitsPagination: document.querySelector("[data-student-recruits-pagination]"),
  researchApplyForm: document.querySelector("[data-research-apply-form]"),
  studentApplications: document.querySelector("[data-student-applications]"),
  studentApplicationsPagination: document.querySelector("[data-student-applications-pagination]"),
  certificateForm: document.querySelector("[data-certificate-form]"),
  certificateList: document.querySelector("[data-certificate-list]"),
  certificateListPagination: document.querySelector("[data-certificate-list-pagination]"),
  certificateCollection: document.querySelector("[data-certificate-collection]"),
  certificateCollectionPagination: document.querySelector("[data-certificate-collection-pagination]"),
  adminUsers: document.querySelector("[data-admin-users]"),
  adminUsersPagination: document.querySelector("[data-admin-users-pagination]"),
  adminDatabase: document.querySelector("[data-admin-database]"),
  adminDatabasePagination: document.querySelector("[data-admin-database-pagination]"),
  adminCompetitionForm: document.querySelector("[data-admin-competition-form]"),
  adminResearchForm: document.querySelector("[data-admin-research-form]"),
  mentorResearchForm: document.querySelector("[data-mentor-research-form]"),
  mentorProjects: document.querySelector("[data-mentor-projects]"),
  mentorProjectsPagination: document.querySelector("[data-mentor-projects-pagination]"),
  mentorApplications: document.querySelector("[data-mentor-applications]"),
  mentorApplicationsPagination: document.querySelector("[data-mentor-applications-pagination]"),
  feedbackForm: document.querySelector("[data-feedback-form]"),
  feedbackList: document.querySelector("[data-feedback-list]"),
  feedbackListPagination: document.querySelector("[data-feedback-list-pagination]"),
  toast: document.querySelector("[data-toast]")
};

selectors.authForm.addEventListener("submit", handleAuthSubmit);
selectors.logoutButton.addEventListener("click", handleLogout);
selectors.opportunityFilters.addEventListener("click", handleOpportunityFilter);
selectors.opportunityList.addEventListener("click", handleOpportunityClick);
selectors.opportunityPagination.addEventListener("click", handleOpportunityPageClick);
selectors.appContent.addEventListener("click", handleListPageClick);
selectors.recruitForm.addEventListener("submit", handleRecruitSubmit);
selectors.detailPanel.addEventListener("click", handleRecruitManagementClick);
selectors.studentRecruits.addEventListener("click", handleRecruitManagementClick);
selectors.researchApplyForm.addEventListener("submit", handleResearchApplySubmit);
selectors.studentApplications.addEventListener("click", handleStudentApplicationsClick);
selectors.certificateForm.addEventListener("submit", handleCertificateSubmit);
selectors.certificateList.addEventListener("click", handleCertificateListClick);
selectors.certificateCollection.addEventListener("click", handleCertificateCollectionClick);
selectors.feedbackForm.addEventListener("submit", handleFeedbackSubmit);
selectors.adminDatabase.addEventListener("click", handleAdminDatabaseClick);
selectors.adminUsers.addEventListener("click", handleAdminUsersClick);
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
  selectedOpportunityPage = 1;
  trackUsage("filter_opportunities", selectedOpportunityType);
  renderOpportunities();
}

function handleOpportunityPageClick(event) {
  const button = event.target.closest("button[data-opportunity-page]");
  if (!button) {
    return;
  }

  selectedOpportunityPage = Number(button.dataset.opportunityPage);
  trackUsage("paginate_opportunities", selectedOpportunityPage);
  renderOpportunities();
}

function handleListPageClick(event) {
  const button = event.target.closest("button[data-list-page-key][data-list-page]");
  if (!button) {
    return;
  }

  listPages[button.dataset.listPageKey] = Number(button.dataset.listPage);
  trackUsage("paginate_list", button.dataset.listPageKey);
  render();
}

function handleOpportunityClick(event) {
  const button = event.target.closest("button[data-opportunity-id]");
  if (!button) {
    return;
  }
  const { opportunityId, opportunityType } = button.dataset;
  trackUsage("view_opportunity", opportunityId);
  renderOpportunityDetail(opportunityType, opportunityId);
  renderOpportunities();
  focusOpportunityDetail();
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
    resetListPage("studentRecruits");
    resetListPage(`competitionRecruits:${created.recruit.competitionId}`);
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

function handleRecruitManagementClick(event) {
  const button = event.target.closest("button[data-team-recruit-action]");
  if (!button) {
    return;
  }

  try {
    requireSession();
    const action = button.dataset.teamRecruitAction;
    const recruitId = button.dataset.teamRecruitId;
    if (action === "stop") {
      const updated = stopTeamRecruit(state, session.user.id, recruitId);
      state = updated.state;
      resetListPage(`competitionRecruits:${updated.recruit.competitionId}`);
      trackUsage("stop_team_recruit", recruitId);
      showToast("招募已结束");
    } else if (action === "resume") {
      const updated = resumeTeamRecruit(state, session.user.id, recruitId);
      state = updated.state;
      resetListPage(`competitionRecruits:${updated.recruit.competitionId}`);
      trackUsage("resume_team_recruit", recruitId);
      showToast("招募已重新开启");
    } else if (action === "delete") {
      const confirmed = window.confirm("确认删除这条组队招募吗？删除后无法恢复。");
      if (!confirmed) {
        return;
      }
      const updated = deleteTeamRecruit(state, session.user.id, recruitId);
      state = updated.state;
      resetListPage("studentRecruits");
      resetListPage(`competitionRecruits:${button.dataset.competitionId}`);
      trackUsage("delete_team_recruit", recruitId);
      showToast("招募已删除");
    }
    saveState();
    render();
    if (session.user.role === "student") {
      renderOpportunityDetail("competition", button.dataset.competitionId ?? "competition_1");
    }
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
    resetListPage("studentApplications");
    resetListPage("mentorApplications");
    trackUsage("apply_research", applied.application.id);
    saveState();
    event.currentTarget.reset();
    showToast("申请已提交，等待导师审核");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleStudentApplicationsClick(event) {
  const button = event.target.closest("button[data-delete-application-id]");
  if (!button) {
    return;
  }

  try {
    requireSession();
    const deleted = deleteResearchApplication(state, session.user.id, button.dataset.deleteApplicationId);
    state = deleted.state;
    resetListPage("studentApplications");
    resetListPage("mentorApplications");
    trackUsage("delete_research_application", button.dataset.deleteApplicationId);
    saveState();
    showToast("申请已删除");
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
    resetListPage("certificateList");
    resetListPage("certificateCollection");
    resetListPage(`certificateCollection:${uploaded.certificateRecord.competitionId}`);
    trackUsage("upload_certificate_record", uploaded.certificateRecord.id);
    saveState();
    formElement.reset();
    showToast("证书记录已保存");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleCertificateListClick(event) {
  const button = event.target.closest("button[data-delete-certificate-id]");
  if (!button) {
    return;
  }

  try {
    requireSession();
    const deleted = deleteCertificateRecord(state, session.user.id, button.dataset.deleteCertificateId);
    state = deleted.state;
    resetListPage("certificateList");
    resetListPage("certificateCollection");
    trackUsage("delete_certificate_record", button.dataset.deleteCertificateId);
    saveState();
    showToast("证书记录已删除");
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleCertificateCollectionClick(event) {
  const downloadButton = event.target.closest("button[data-download-certificate-id]");
  if (downloadButton) {
    const record = findCollectorCertificateRecord(downloadButton.dataset.downloadCertificateId);
    if (!record) {
      showToast("证书记录不存在", true);
      return;
    }
    if (!record.downloadUrl) {
      showToast("这条证书没有可下载文件", true);
      return;
    }
    downloadDataUrl(record.downloadUrl, record.archiveFileName);
    trackUsage("download_certificate_record", record.id);
    saveState();
    return;
  }

  const exportButton = event.target.closest("button[data-export-competition-id]");
  if (!exportButton) {
    return;
  }

  try {
    const group = findCollectorCertificateGroup(exportButton.dataset.exportCompetitionId);
    if (!group) {
      throw new DomainError("证书合集不存在", "CERTIFICATE_GROUP_NOT_FOUND");
    }
    const entries = group.records
      .filter((record) => record.downloadUrl)
      .map((record) => ({
        path: record.archiveFileName,
        dataUrl: record.downloadUrl
      }));
    if (entries.length === 0) {
      throw new DomainError("这个比赛还没有可导出的证书文件", "NO_DOWNLOADABLE_CERTIFICATES");
    }
    const zipBlob = await createZipBlob(entries);
    downloadBlob(zipBlob, group.archiveName);
    trackUsage("export_certificate_archive", group.competitionId);
    saveState();
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
    resetListPage("adminDatabase");
    resetListPage(`adminDatabase:${button.dataset.deleteTable}`);
    trackUsage("delete_database_record", `${button.dataset.deleteTable}:${button.dataset.deleteId}`);
    saveState();
    showToast("记录已删除");
    renderAdmin();
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function handleAdminUsersClick(event) {
  const button = event.target.closest("button[data-admin-user-action]");
  if (!button) {
    return;
  }

  try {
    requireSession();
    const action = button.dataset.adminUserAction;
    const userId = button.dataset.adminUserId;
    if (action === "block") {
      const updated = blockUser(state, session.user.id, userId);
      state = updated.state;
      resetListPage("adminUsers");
      trackUsage("block_user", userId);
      showToast("用户已封禁");
    } else if (action === "unblock") {
      const updated = unblockUser(state, session.user.id, userId);
      state = updated.state;
      resetListPage("adminUsers");
      trackUsage("unblock_user", userId);
      showToast("用户已解除封禁");
    } else if (action === "delete") {
      const updated = deleteUser(state, session.user.id, userId);
      state = updated.state;
      resetListPage("adminUsers");
      trackUsage("delete_user", userId);
      showToast("用户已删除");
    }
    saveState();
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
    resetListPage("adminDatabase");
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
    resetListPage("adminDatabase");
    resetListPage("mentorProjects");
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
    resetListPage("mentorProjects");
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
    resetListPage("mentorProjects");
    resetListPage("adminDatabase");
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
    resetListPage("mentorApplications");
    resetListPage("studentApplications");
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
    resetListPage("feedbackList");
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
  renderSelectedOpportunityDetail();
  renderStudentRecruits();
  renderStudentApplications();
  renderCertificates();
  renderCertificateCollection();
  renderAdmin();
  renderMentorProjects();
  renderMentorApplications();
  renderFeedback();
}

function renderSelectedOpportunityDetail() {
  if (selectedOpportunityId && selectedOpportunityDetailType) {
    renderOpportunityDetail(selectedOpportunityDetailType, selectedOpportunityId);
  }
}

function renderAuth() {
  selectors.userBadge.textContent = session
    ? `${session.user.name} · ${roleLabel(session.user.role)}`
    : "未登录";
  selectors.userBadge.hidden = !session;
  selectors.logoutButton.hidden = !session;
  selectors.authPanel.hidden = Boolean(session);
  selectors.appContent.classList.toggle("is-auth-screen", !session);
  selectors.appPanels.forEach((panel) => {
    const role = panel.dataset.rolePanel;
    panel.hidden = !session || Boolean(role && role !== session.user.role);
  });
  showInlineMessage(selectors.authMessage, null);
}

function renderOpportunities() {
  const filter = selectedOpportunityType === "all"
    ? {}
    : { type: selectedOpportunityType };
  const opportunities = listOpportunities(state, filter);
  const totalPages = Math.max(1, Math.ceil(opportunities.length / opportunityPageSize));
  selectedOpportunityPage = Math.min(Math.max(selectedOpportunityPage, 1), totalPages);
  const pageStart = (selectedOpportunityPage - 1) * opportunityPageSize;
  const pagedOpportunities = opportunities.slice(pageStart, pageStart + opportunityPageSize);

  selectors.opportunityFilters.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === selectedOpportunityType);
  });

  selectors.opportunityList.innerHTML = pagedOpportunities
    .map(
      (opportunity) => {
        const isSelected = opportunity.id === selectedOpportunityId
          && opportunity.type === selectedOpportunityDetailType;
        return `
        <article class="item-card${isSelected ? " is-selected" : ""}" aria-current="${isSelected ? "true" : "false"}">
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
            <button data-opportunity-id="${opportunity.id}" data-opportunity-type="${opportunity.type}" aria-current="${isSelected ? "true" : "false"}">${isSelected ? "正在查看" : "查看"}</button>
          </footer>
        </article>
      `;
      }
    )
    .join("");
  renderOpportunityPagination(totalPages);
}

function renderOpportunityPagination(totalPages) {
  if (totalPages <= 1) {
    selectors.opportunityPagination.innerHTML = "";
    return;
  }

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const isActive = page === selectedOpportunityPage;
    return `
      <button
        class="${isActive ? "is-active" : "secondary"}"
        data-opportunity-page="${page}"
        ${isActive ? `aria-current="page"` : ""}
      >${page}</button>
    `;
  }).join("");

  selectors.opportunityPagination.innerHTML = `
    <button class="secondary" data-opportunity-page="${Math.max(1, selectedOpportunityPage - 1)}" ${selectedOpportunityPage === 1 ? "disabled" : ""}>上一页</button>
    <div class="page-numbers">${pageButtons}</div>
    <button class="secondary" data-opportunity-page="${Math.min(totalPages, selectedOpportunityPage + 1)}" ${selectedOpportunityPage === totalPages ? "disabled" : ""}>下一页</button>
  `;
}

function paginateItems(items, key, pageSize = listPageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(Number(listPages[key] ?? 1), 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  listPages[key] = currentPage;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    currentPage
  };
}

function renderPagination(key, totalPages, label) {
  if (totalPages <= 1) {
    return "";
  }

  const currentPage = listPages[key] ?? 1;
  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const isActive = page === currentPage;
    return `
      <button
        class="${isActive ? "is-active" : "secondary"}"
        data-list-page-key="${escapeHtml(key)}"
        data-list-page="${page}"
        ${isActive ? `aria-current="page"` : ""}
      >${page}</button>
    `;
  }).join("");

  return `
    <button class="secondary" data-list-page-key="${escapeHtml(key)}" data-list-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? "disabled" : ""}>上一页</button>
    <div class="page-numbers">${pageButtons}</div>
    <button class="secondary" data-list-page-key="${escapeHtml(key)}" data-list-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? "disabled" : ""}>下一页</button>
    <small>${escapeHtml(label)} 第 ${currentPage} / ${totalPages} 页</small>
  `;
}

function resetListPage(key) {
  listPages[key] = 1;
}

function renderOpportunityDetail(type, id) {
  selectedOpportunityId = id;
  selectedOpportunityDetailType = type;
  selectors.detailPanel.setAttribute("tabindex", "-1");
  selectors.detailPanel.setAttribute("aria-live", "polite");

  if (type === "competition") {
    const detail = getCompetitionDetail(state, id);
    const recruitsPage = paginateItems(detail.teamRecruits, `competitionRecruits:${id}`);
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
      ${renderRecruitList(recruitsPage.items)}
      <nav class="pagination compact-pagination">${renderPagination(`competitionRecruits:${id}`, recruitsPage.totalPages, `${detail.title}组队招募`)}</nav>
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

function focusOpportunityDetail() {
  selectors.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  selectors.detailPanel.focus({ preventScroll: true });
}

function renderRecruitList(recruits) {
  if (recruits.length === 0) {
    return `<p class="empty">暂无招募，登录后可发布第一条。</p>`;
  }
  const currentStudentId = getCurrentStudentId();
  return recruits
    .map(
      (recruit) => `
        <section class="mini-card recruit-card">
          <div class="recruit-body">
            <div class="recruit-main">
              <span class="status-pill ${recruit.status === "招募中" ? "is-open" : "is-closed"}">${escapeHtml(recruit.status)}</span>
              <strong>${escapeHtml(recruit.title)}</strong>
              <span class="recruit-meta">${escapeHtml(recruit.competitionTitle)} · ${escapeHtml(recruit.publisherName)}</span>
              <span class="recruit-contact">联系方式：${escapeHtml(recruit.contact)}</span>
              <div class="recruit-tags">
                ${recruit.skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}
              </div>
            </div>
            ${currentStudentId && recruit.studentId === currentStudentId
              ? `
                <div class="button-row">
                  ${recruit.status === "招募中"
                    ? `<button data-team-recruit-action="stop" data-team-recruit-id="${escapeHtml(recruit.id)}" data-competition-id="${escapeHtml(recruit.competitionId)}">结束招募</button>`
                    : `<button data-team-recruit-action="resume" data-team-recruit-id="${escapeHtml(recruit.id)}" data-competition-id="${escapeHtml(recruit.competitionId)}">继续招募</button>`}
                  <button class="secondary" data-team-recruit-action="delete" data-team-recruit-id="${escapeHtml(recruit.id)}" data-competition-id="${escapeHtml(recruit.competitionId)}">删除</button>
                </div>
              `
              : ""}
          </div>
        </section>
      `
    )
    .join("");
}

function getCurrentStudentId() {
  if (!session || session.user.role !== "student") {
    return null;
  }
  return state.students.find((student) => student.userId === session.user.id)?.id ?? null;
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

function renderStudentRecruits() {
  if (!session || session.user.role !== "student") {
    selectors.studentRecruits.innerHTML = `<p class="empty">登录后显示你发布的组队招募。</p>`;
    selectors.studentRecruitsPagination.innerHTML = "";
    return;
  }

  const recruits = listTeamRecruitsForStudent(state, session.user.id);
  const page = paginateItems(recruits, "studentRecruits");
  selectors.studentRecruits.innerHTML = recruits.length === 0
    ? `<p class="empty">还没有发布组队招募。</p>`
    : renderRecruitList(page.items);
  selectors.studentRecruitsPagination.innerHTML = renderPagination("studentRecruits", page.totalPages, "我的招募");
}

function renderStudentApplications() {
  if (!session || session.user.role !== "student") {
    selectors.studentApplications.innerHTML = `<p class="empty">登录后显示你的科研申请结果。</p>`;
    selectors.studentApplicationsPagination.innerHTML = "";
    return;
  }

  const applications = listResearchApplicationsForStudent(state, session.user.id);
  const page = paginateItems(applications, "studentApplications");
  selectors.studentApplications.innerHTML = applications.length === 0
    ? `<p class="empty">还没有科研申请记录。</p>`
    : page.items
        .map(
          (application) => `
            <section class="mini-card">
              <div class="record-head">
                <div>
                  <strong>${escapeHtml(application.researchTitle)} · ${escapeHtml(application.status)}</strong>
                  <span>${escapeHtml(application.statement)}</span>
                </div>
                <button class="secondary" data-delete-application-id="${escapeHtml(application.id)}">删除</button>
              </div>
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
  selectors.studentApplicationsPagination.innerHTML = renderPagination("studentApplications", page.totalPages, "我的申请");
}

function renderCertificates() {
  if (!session || session.user.role !== "student") {
    selectors.certificateList.innerHTML = `<p class="empty">登录后显示个人证书记录。</p>`;
    selectors.certificateListPagination.innerHTML = "";
    return;
  }

  const records = listCertificateRecords(state, session.user.id);
  const page = paginateItems(records, "certificateList");
  selectors.certificateList.innerHTML = records.length === 0
    ? `<p class="empty">还没有证书记录。</p>`
    : page.items
        .map(
          (record) => `
            <section class="mini-card">
              ${renderCertificatePreview(record)}
              <div class="record-head">
                <div>
                  <strong>${escapeHtml(record.competitionTitle)}</strong>
                  <span>${escapeHtml(record.awardLevel)} · ${escapeHtml(record.awardDate)}</span>
                  <small>${escapeHtml(record.fileSummary)}</small>
                </div>
                <button class="secondary" data-delete-certificate-id="${escapeHtml(record.id)}">删除</button>
              </div>
            </section>
          `
        )
        .join("");
  selectors.certificateListPagination.innerHTML = renderPagination("certificateList", page.totalPages, "个人证书");
}

function renderCertificateCollection() {
  if (!session || session.user.role !== "certificate_collector") {
    selectors.certificateCollection.innerHTML = `<p class="empty">切换为证书收集者后显示汇总。</p>`;
    selectors.certificateCollectionPagination.innerHTML = "";
    return;
  }

  const groups = listCertificateCollectionByCompetition(state, session.user.id);
  const page = paginateItems(groups, "certificateCollection");
  selectors.certificateCollection.innerHTML = groups.length === 0
    ? `<p class="empty">还没有证书记录。</p>`
    : page.items
        .map(
          (group) => {
            const recordsPage = paginateItems(group.records, `certificateCollection:${group.competitionId}`);
            return `
            <details class="collection-group" open>
              <summary>
                <span>${escapeHtml(group.competitionTitle)}</span>
                <small>${group.records.length} 份证书</small>
              </summary>
              <div class="collection-tools">
                <button data-export-competition-id="${escapeHtml(group.competitionId)}">导出合集</button>
              </div>
              <div class="stack">
                ${recordsPage.items
                  .map(
                    (record) => `
                      <section class="mini-card">
                        ${renderCertificatePreview(record)}
                        <div class="record-head">
                          <div>
                            <strong>${escapeHtml(record.awardSummary)}</strong>
                            <span>${escapeHtml(record.uploaderName)} · ${escapeHtml(record.awardDate)}</span>
                            <small>${escapeHtml(record.fileSummary)}</small>
                          </div>
                          <button class="secondary" data-download-certificate-id="${escapeHtml(record.id)}">下载</button>
                        </div>
                      </section>
                    `
                  )
                  .join("")}
              </div>
              <nav class="pagination compact-pagination">${renderPagination(`certificateCollection:${group.competitionId}`, recordsPage.totalPages, `${group.competitionTitle}证书`)}</nav>
            </details>
          `;
          }
        )
        .join("");
  selectors.certificateCollectionPagination.innerHTML = renderPagination("certificateCollection", page.totalPages, "证书汇总");
}

function renderAdmin() {
  if (!session || session.user.role !== "admin") {
    selectors.adminUsers.innerHTML = `<p class="empty">切换为管理员后显示注册用户。</p>`;
    selectors.adminUsersPagination.innerHTML = "";
    selectors.adminDatabase.innerHTML = "";
    selectors.adminDatabasePagination.innerHTML = "";
    return;
  }

  const users = listRegisteredUsers(state, session.user.id);
  const usersPage = paginateItems(users, "adminUsers");
  const currentUserId = session.user.id;
  selectors.adminUsers.innerHTML = usersPage.items
    .map(
      (user) => `
        <section class="mini-card">
          <div class="record-head">
            <div>
              <strong>${escapeHtml(user.name)} · ${escapeHtml(user.roleLabel)}</strong>
              <span>${escapeHtml(user.email)} · ${escapeHtml(user.status)}</span>
              <small>${escapeHtml(user.id)}</small>
            </div>
            ${user.id === currentUserId
              ? `<small>当前登录</small>`
              : `
                <div class="button-row">
                  <button data-admin-user-action="${user.status === "封禁" ? "unblock" : "block"}" data-admin-user-id="${escapeHtml(user.id)}">${user.status === "封禁" ? "解封" : "封禁"}</button>
                  <button class="secondary" data-admin-user-action="delete" data-admin-user-id="${escapeHtml(user.id)}">删除</button>
                </div>
              `}
          </div>
        </section>
      `
    )
    .join("");
  selectors.adminUsersPagination.innerHTML = renderPagination("adminUsers", usersPage.totalPages, "注册用户");

  const view = getAdminDatabaseView(state, session.user.id);
  const tablePage = paginateItems(view.tables, "adminDatabase");
  selectors.adminDatabase.innerHTML = tablePage.items
    .map((table) => {
      const recordPage = paginateItems(table.records, `adminDatabase:${table.name}`);
      const rowList = table.records.length === 0
        ? `<p class="empty">空表</p>`
        : recordPage.items
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
          <nav class="pagination compact-pagination">${renderPagination(`adminDatabase:${table.name}`, recordPage.totalPages, `${table.label}记录`)}</nav>
        </article>
      `;
    })
    .join("");
  selectors.adminDatabasePagination.innerHTML = renderPagination("adminDatabase", tablePage.totalPages, "数据库表");
}

function renderMentorApplications() {
  if (!session || session.user.role !== "mentor") {
    selectors.mentorApplications.innerHTML = `<p class="empty">切换为导师后显示申请队列。</p>`;
    selectors.mentorApplicationsPagination.innerHTML = "";
    return;
  }

  const applications = listResearchApplicationsForMentor(state, session.user.id);
  const page = paginateItems(applications, "mentorApplications");
  selectors.mentorApplications.innerHTML = applications.length === 0
    ? `<p class="empty">暂无科研项目申请。</p>`
    : page.items
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
  selectors.mentorApplicationsPagination.innerHTML = renderPagination("mentorApplications", page.totalPages, "科研申请队列");
}

function renderMentorProjects() {
  if (!session || session.user.role !== "mentor") {
    selectors.mentorProjects.innerHTML = `<p class="empty">切换为导师后显示你发布的科研项目。</p>`;
    selectors.mentorProjectsPagination.innerHTML = "";
    return;
  }

  const projects = listResearchProjectsForMentor(state, session.user.id);
  const page = paginateItems(projects, "mentorProjects");
  selectors.mentorProjects.innerHTML = projects.length === 0
    ? `<p class="empty">还没有发布科研项目。</p>`
    : page.items
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
  selectors.mentorProjectsPagination.innerHTML = renderPagination("mentorProjects", page.totalPages, "我的科研项目");
}

function renderFeedback() {
  const entries = listFeedbackEntries(state);
  const page = paginateItems(entries, "feedbackList");
  selectors.feedbackList.innerHTML = entries.length === 0
    ? `<p class="empty">暂无反馈记录。</p>`
    : page.items
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
  selectors.feedbackListPagination.innerHTML = session
    ? renderPagination("feedbackList", page.totalPages, "使用反馈")
    : "";
}

function renderCertificatePreview(record) {
  if (record.hasPreview && record.previewUrl) {
    return `<img class="certificate-preview" src="${escapeHtml(record.previewUrl)}" alt="证书预览">`;
  }
  return `<div class="certificate-preview is-placeholder">暂无图片预览</div>`;
}

function findCollectorCertificateGroup(competitionId) {
  if (!session || session.user.role !== "certificate_collector") {
    return null;
  }
  return listCertificateCollectionByCompetition(state, session.user.id)
    .find((group) => group.competitionId === competitionId);
}

function findCollectorCertificateRecord(certificateRecordId) {
  if (!session || session.user.role !== "certificate_collector") {
    return null;
  }
  return listCertificateCollectionByCompetition(state, session.user.id)
    .flatMap((group) => group.records)
    .find((record) => record.id === certificateRecordId);
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
  if (!file) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(`${reader.result ?? ""}`));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    downloadDataUrl(objectUrl, fileName);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

async function createZipBlob(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBytes = new TextEncoder().encode(entry.path);
    const fileBytes = dataUrlToBytes(entry.dataUrl);
    const crc = crc32(fileBytes);
    const localHeader = concatBytes(
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(fileBytes.length),
      uint32(fileBytes.length),
      uint16(fileNameBytes.length),
      uint16(0),
      fileNameBytes
    );
    const centralHeader = concatBytes(
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(fileBytes.length),
      uint32(fileBytes.length),
      uint16(fileNameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      fileNameBytes
    );
    localParts.push(localHeader, fileBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + fileBytes.length;
  }

  const centralDirectory = concatBytes(...centralParts);
  const endRecord = concatBytes(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0)
  );

  return new Blob([...localParts, centralDirectory, endRecord], {
    type: "application/zip"
  });
}

function dataUrlToBytes(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return new TextEncoder().encode(dataUrl);
  }

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  if (metadata.includes(";base64")) {
    const binary = atob(payload);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crc32.table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

crc32.table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function uint16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
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
