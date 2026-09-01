// dom.js — Cache des references DOM (refreshDOM)
// (extrait de l'ancien app.js, chargement en scope global classique)

let DOM = {};

function refreshDOM() {
    DOM = {
        // Nav & Views
        navItems: document.querySelectorAll('.nav-item'),
        viewSections: document.querySelectorAll('.view-section'),

        // Project View
        projectsTbody: document.getElementById('projectsTbody'),
        btnNewProject: document.getElementById('btnNewProject'),
        projectModal: document.getElementById('projectModal'),
        projectModalTitle: document.getElementById('projectModalTitle'),
        btnCloseProjectModal: document.getElementById('btnCloseProjectModal'),
        projectForm: document.getElementById('projectForm'),
        pId: document.getElementById('pId'),
        pClient: document.getElementById('pClient'),
        pName: document.getElementById('pName'),
        pStateInput: document.getElementById('pStateInput'),
        btnAddState: document.getElementById('btnAddState'),
        projectStatesContainer: document.getElementById('projectStatesContainer'),
        pUserSelectToAdd: document.getElementById('pUserSelectToAdd'),
        btnAddExistingUser: document.getElementById('btnAddExistingUser'),
        pNewUserName: document.getElementById('pNewUserName'),
        btnCreateAndAddUser: document.getElementById('btnCreateAndAddUser'),
        projectMembersContainer: document.getElementById('projectMembersContainer'),
        pRatioC: document.getElementById('pRatioC'),
        pRatioE: document.getElementById('pRatioE'),

        // User UI
        usersTbody: document.getElementById('usersTbody'),
        btnNewUser: document.getElementById('btnNewUser'),
        userModal: document.getElementById('userModal'),
        userModalTitle: document.getElementById('userModalTitle'),
        btnCloseUserModal: document.getElementById('btnCloseUserModal'),
        userForm: document.getElementById('userForm'),
        uId: document.getElementById('uId'),
        uiName: document.getElementById('uiName'),
        uRole: document.getElementById('uRole'),

        // Version UI
        btnNewVersion: document.getElementById('btnNewVersion'),
        btnNewVersionPage: document.getElementById('btnNewVersionPage'),
        versionsTbody: document.getElementById('versionsTbody'),
        versionModal: document.getElementById('versionModal'),
        versionModalTitle: document.getElementById('versionModalTitle'),
        btnCloseVersionModal: document.getElementById('btnCloseVersionModal'),
        versionForm: document.getElementById('versionForm'),
        vId: document.getElementById('vId'),
        vClient: document.getElementById('vClient'),
        vProject: document.getElementById('vProject'),
        vName: document.getElementById('vName'),
        vDate_D: document.getElementById('vDate_D'),
        vDate_M: document.getElementById('vDate_M'),
        vDate_Y: document.getElementById('vDate_Y'),
        vDateActual_D: document.getElementById('vDateActual_D'),
        vDateActual_M: document.getElementById('vDateActual_M'),
        vDateActual_Y: document.getElementById('vDateActual_Y'),

        clientSelect: document.getElementById('clientSelect'),
        projectSelect: document.getElementById('projectSelect'),
        versionSelect: document.getElementById('versionSelect'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        ticketsTbody: document.getElementById('ticketsTbody'),
        filterUser: document.getElementById('filterUser'),
        btnNewTicket: document.getElementById('btnNewTicket'),
        btnCopyDashboard: document.getElementById('btnCopyDashboard'),
        btnCopyCharts: document.getElementById('btnCopyCharts'),
        modal: document.getElementById('ticketModal'),
        btnCloseModal: document.getElementById('btnCloseModal'),
        ticketForm: document.getElementById('ticketForm'),

        // KPI
        kpiTotalRaf: document.getElementById('kpiTotalRaf'),
        kpiTotalTickets: document.getElementById('kpiTotalTickets'),
        kpiAdvC: document.getElementById('kpiAdvC'),
        kpiAdvE: document.getElementById('kpiAdvE'),
        kpiAdvTotal: document.getElementById('kpiAdvTotal'),
        dashProjectName: document.getElementById('dashProjectName'),
        dashVersionName: document.getElementById('dashVersionName'),

        // Form Inputs
        fFeat: document.getElementById('fFeat'), fFeatList: document.getElementById('feature-list'),
        fType: document.getElementById('fType'),
        fNum: document.getElementById('fNum'), fPrio: document.getElementById('fPrio'),
        fAssC: document.getElementById('fAssC'), fAssE: document.getElementById('fAssE'),
        fTests: document.getElementById('fTests'), fState: document.getElementById('fState'),
        fVersion: document.getElementById('fVersion'),
        tId: document.getElementById('tId'),
        mainContent: document.querySelector('.main-content')
    };

    debug("DOM elements refreshed. projectsTbody exists:", !!DOM.projectsTbody);
}

