const fs = require('fs');
const { execSync } = require('child_process');

const mode = process.argv[2] || 'version'; // version | alpha | rc | prod
const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

// test

let version = pkg.version;

// Utility to bump version components
function bumpVersion(version, type) {
  let [core, pre] = version.split('-');
  let [major, minor, patch] = core.split('.').map(Number);

  if (type === 'z') {
    patch++;
    if (patch > 9) {
      patch = 0;
      minor++;
    }
    if (minor > 9) {
      minor = 0;
      major++;
    }
  }

  return `${major}.${minor}.${patch}`;
}

// Utility to bump N in alpha.N or rc.N
function bumpPreRelease(version, tagType) {
  let [core, pre] = version.split('-');
  if (!pre || !pre.startsWith(tagType)) {
    return `${core}-${tagType}.0`;
  }
  const [, n] = pre.split('.');
  return `${core}-${tagType}.${parseInt(n) + 1}`;
}

// Utility to strip pre-release
function stripPreRelease(version) {
  return version.split('-')[0];
}

function saveAndPushVersion(newVersion) {
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  execSync('git add package.json');
  execSync(`git commit -m "Release for v${newVersion}"`);
  execSync(`git push origin ${branch}`);
  console.log(`✅ Version bumped to ${newVersion}`);
}

function tagAndPush(version) {
  execSync(`git tag v${version}`);
  execSync(`git push origin v${version}`);
  console.log(`🏷️ Tagged and pushed v${version}`);
}

let newVersion = version;

switch (branch) {
  case 'developers':
    if (mode === 'version') {
      newVersion = bumpVersion(stripPreRelease(version), 'z') + '-alpha.0';
      saveAndPushVersion(newVersion);
    } else {
      console.error('❌ Only "yarn release" allowed on developers branch');
      process.exit(1);
    }
    break;

  case 'development':
    if (mode === 'alpha') {
      newVersion = bumpPreRelease(version, 'alpha');
      saveAndPushVersion(newVersion);
    } else {
      console.error('❌ Only "yarn release:alpha" allowed on development branch');
      process.exit(1);
    }
    break;

  case 'qa':
    if (mode === 'rc') {
      newVersion = bumpPreRelease(version, 'rc');
      saveAndPushVersion(newVersion);
    } else {
      console.error('❌ Only "yarn release:qa" allowed on qa branch');
      process.exit(1);
    }
    break;

  case 'master':
    if (mode === 'prod') {
      newVersion = stripPreRelease(version);
      saveAndPushVersion(newVersion);
      tagAndPush(newVersion);
    } else {
      console.error('❌ Only "yarn release:prod" allowed on master branch');
      process.exit(1);
    }
    break;

  default:
    console.error(`❌ Unsupported branch: ${branch}`);
    process.exit(1);
}
