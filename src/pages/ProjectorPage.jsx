const APK_BASE = import.meta.env.BASE_URL + 'apk/'

const APPS = [
  {
    id: 'aviation',
    name: 'Live Aviation',
    pkg: 'com.sinhaankur.aviation',
    file: 'live-aviation.apk',
    loads: 'sinhaankur.github.io/AirbusEngine3D/#/live',
    desc: 'Boots straight into the live flight tracker — a 3D globe of real aircraft currently in the air, streamed from airplanes.live.',
  },
  {
    id: 'universe',
    name: 'Universe Engine',
    pkg: 'com.sinhaankur.universe',
    file: 'universe-engine.apk',
    loads: 'sinhaankur.com/tv',
    desc: 'The Universe Engine TV shell — planets, the Sun, constellations and nearby stars, with remote-friendly navigation built for big screens.',
  },
]

export default function ProjectorPage() {
  return (
    <div>
      <div className="masthead">
        <h1>Projector <span className="accent">apps</span></h1>
        <p>
          Two sideloadable Android apps that turn a cheap HY300-class projector
          (Android 11) into a dedicated big-screen appliance. Each app is a
          fullscreen shell that connects over WiFi, streams its experience from
          the web, and retries automatically until the network is up.
        </p>
      </div>

      <div className="proj-grid">
        {APPS.map((app) => (
          <div className="proj-card" key={app.id}>
            <div className="proj-card-head">
              <span className="proj-name">{app.name}</span>
              <span className="idx-tag live">APK</span>
            </div>
            <p className="proj-desc">{app.desc}</p>
            <div className="proj-meta">
              <span className="k">loads</span>
              <span className="v">{app.loads}</span>
            </div>
            <div className="proj-meta">
              <span className="k">package</span>
              <span className="v">{app.pkg}</span>
            </div>
            <a className="proj-download" href={APK_BASE + app.file} download>
              ↓ Download {app.file}
            </a>
          </div>
        ))}
      </div>

      <div className="proj-install">
        <h2>Install on the projector</h2>
        <ol>
          <li>Download both APKs and copy them onto a USB stick.</li>
          <li>Plug the stick into the projector and open its file manager.</li>
          <li>
            Open each APK and confirm the install — allow{' '}
            <em>Install from unknown sources</em> if prompted.
          </li>
          <li>
            Launch from the app list. Each app goes fullscreen, keeps the screen
            on, and auto-retries until the projector's WiFi is connected — so
            it's safe to launch right after power-on.
          </li>
        </ol>
        <p className="proj-fine">
          Prefer mirroring a laptop instead? The projector's HDMI input is the
          lowest-latency option; for wireless, sideload an AirPlay receiver app
          and use the Mac's built-in screen mirroring.
        </p>
      </div>
    </div>
  )
}
