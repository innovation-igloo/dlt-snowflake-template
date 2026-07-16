import { NavLink, Outlet } from 'react-router-dom';
import Note from '../components/Note';

export default function Observability() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Run Metadata</p>
        <h2>Observability</h2>
        <p className="sub">
          Observability has two complementary layers. <b>DLT</b> gives you application-level metadata
          about what a run did (rows loaded, failed jobs, schema, incremental state). <b>SPCS</b> gives you
          infrastructure-level telemetry about the container that ran it (logs, CPU/memory, restarts,
          crashes), all landing in Snowflake's event table. Together they are the full picture.
        </p>

        <Note variant="tip">
          &quot;Telemetry&quot; on this page means <b>observability</b> — logs, metrics, and traces in your
          Snowflake event table. It is not dlt&apos;s anonymous <i>usage</i> telemetry to dltHub, which the
          template disables by default (<code>runtime.dlthub_telemetry=false</code>; see <b>Enterprise</b>).
        </Note>

        <div className="tabs">
          <NavLink end to="/observability" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            DLT
          </NavLink>
          <NavLink
            to="/observability/spcs"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            DLT and SPCS
          </NavLink>
          <NavLink
            to="/observability/multi-pipeline"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Multi-pipeline
          </NavLink>
        </div>

        <div className="tabpanel">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
