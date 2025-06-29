const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2]; // 'version' or 'changelog'

if (!mode || !['version', 'changelog'].includes(mode)) {
  console.error("❌ Please pass 'version' or 'changelog' as an argument.");
  process.exit(1);
}

const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const pkgPath = path.resolve(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

if (mode === 'version') {
  const versionParts = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|rc)\.(\d+))?$/);

  if (!versionParts) {
    console.error('❌ Invalid version format:', currentVersion);
    process.exit(1);
  }

  const [_, major, minor, patch, tagType, tagNumber] = versionParts;
  let nextVersion;

  function getNextBaseVersion(major, minor, patch) {
    let nextMajor = parseInt(major);
    let nextMinor = parseInt(minor);
    let nextPatch = parseInt(patch);

    if (nextPatch < 9) {
      nextPatch++;
    } else {
      nextPatch = 0;
      if (nextMinor < 9) {
        nextMinor++;
      } else {
        nextMinor = 0;
        nextMajor++;
      }
    }

    return `${nextMajor}.${nextMinor}.${nextPatch}`;
  }

  if (branch === 'developers' || branch === 'development') {
    const nextTag = tagType === 'alpha' ? parseInt(tagNumber || '0') + 1 : 1;
    const baseVersion = `${major}.${minor}.${patch}`;
    nextVersion = `${baseVersion}-alpha.${nextTag}`;
  } else if (branch === 'qa') {
    const nextTag = tagType === 'rc' ? parseInt(tagNumber || '0') + 1 : 1;
    const baseVersion = `${major}.${minor}.${patch}`;
    nextVersion = `${baseVersion}-rc.${nextTag}`;
  } else if (branch === 'master') {
    const bumped = getNextBaseVersion(major, minor, patch);
    nextVersion = bumped;
  } else {
    console.error('❌ Unsupported branch:', branch);
    process.exit(1);
  }

  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  execSync(`git add package.json`);
  execSync(`git commit -m "Release for v${nextVersion}"`);
  execSync(`git push origin ${branch}`);

  console.log(`✅ Version bumped and pushed: ${nextVersion}`);
} else if (mode === 'changelog') {
  const changelogPath = path.resolve(__dirname, 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.error('❌ CHANGELOG.md file not found.');
    process.exit(1);
  }

  execSync(`git add CHANGELOG.md`);
  execSync(`git commit -m "CHANGELOG for v${currentVersion}"`);
  execSync(`git tag v${currentVersion}`);
  execSync(`git push origin ${branch} --follow-tags`);

  console.log(`✅ CHANGELOG committed and tagged: v${currentVersion}`);
}
