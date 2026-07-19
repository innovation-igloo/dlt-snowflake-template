import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import About from './pages/About';
import Overview from './pages/Overview';
import Architecture from './pages/Architecture';
import RepoStructure from './pages/RepoStructure';
import Auth from './pages/Auth';
import Setup from './pages/Setup';
import Backends from './pages/sql/Backends';
import Incremental from './pages/sql/Incremental';
import WriteMerge from './pages/sql/WriteMerge';
import SchemaTypes from './pages/sql/SchemaTypes';
import SourceShaping from './pages/sql/SourceShaping';
import Performance from './pages/sql/Performance';
import Databases from './pages/sql/Databases';
import VerifiedOverview from './pages/verified/Overview';
import VerifiedCatalog from './pages/verified/Catalog';
import VerifiedOnboarding from './pages/verified/Onboarding';
import VerifiedAuth from './pages/verified/Auth';
import VerifiedIncremental from './pages/verified/Incremental';
import VerifiedSalesforce from './pages/verified/Salesforce';
import VerifiedOps from './pages/verified/Ops';
import ApiConfig from './pages/api/Config';
import ApiAuth from './pages/api/Authentication';
import ApiPagination from './pages/api/Pagination';
import ApiIncremental from './pages/api/Incremental';
import ApiRelationships from './pages/api/Relationships';
import ApiResponseProcessing from './pages/api/ResponseProcessing';
import ApiClientRetries from './pages/api/ClientRetries';
import Observability from './pages/Observability';
import DltTab from './pages/observability/DltTab';
import SpcsTab from './pages/observability/SpcsTab';
import MultiPipelineTab from './pages/observability/MultiPipelineTab';
import Deploy from './pages/Deploy';
import CreditCost from './pages/CreditCost';
import Scaling from './pages/Scaling';
import Enterprise from './pages/Enterprise';
import Roadmap from './pages/Roadmap';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<About />} />
          <Route path="overview" element={<Overview />} />
          <Route path="architecture" element={<Architecture />} />
          <Route path="repo" element={<RepoStructure />} />
          <Route path="auth" element={<Auth />} />
          <Route path="setup" element={<Setup />} />
          <Route path="backends" element={<Backends />} />
          <Route path="incremental" element={<Incremental />} />
          <Route path="merge" element={<WriteMerge />} />
          <Route path="schema" element={<SchemaTypes />} />
          <Route path="source-shaping" element={<SourceShaping />} />
          <Route path="performance" element={<Performance />} />
          <Route path="databases" element={<Databases />} />
          <Route path="verified/overview" element={<VerifiedOverview />} />
          <Route path="verified/catalog" element={<VerifiedCatalog />} />
          <Route path="verified/onboarding" element={<VerifiedOnboarding />} />
          <Route path="verified/auth" element={<VerifiedAuth />} />
          <Route path="verified/incremental" element={<VerifiedIncremental />} />
          <Route path="verified/salesforce" element={<VerifiedSalesforce />} />
          <Route path="verified/ops" element={<VerifiedOps />} />
          <Route path="api/config" element={<ApiConfig />} />
          <Route path="api/auth" element={<ApiAuth />} />
          <Route path="api/pagination" element={<ApiPagination />} />
          <Route path="api/incremental" element={<ApiIncremental />} />
          <Route path="api/relationships" element={<ApiRelationships />} />
          <Route path="api/response" element={<ApiResponseProcessing />} />
          <Route path="api/client" element={<ApiClientRetries />} />
          <Route path="observability" element={<Observability />}>
            <Route index element={<DltTab />} />
            <Route path="spcs" element={<SpcsTab />} />
            <Route path="multi-pipeline" element={<MultiPipelineTab />} />
          </Route>
          <Route path="deploy" element={<Deploy />} />
          <Route path="cost" element={<CreditCost />} />
          <Route path="scaling" element={<Scaling />} />
          <Route path="enterprise" element={<Enterprise />} />
          <Route path="roadmap" element={<Roadmap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
