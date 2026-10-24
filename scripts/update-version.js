const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

try {
    // Get the latest commit message
    const commitMessage = execFileSync('git', ['log', '-1', '--pretty=%B'], { cwd: path.dirname(packageJsonPath), stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    console.log(`Latest commit message: "${commitMessage}"`);

    // Regex to find version (e.g., v1.1.4e or 1.1.4e)
    // Matches "v" (optional) followed by digits.digits.digits and optional letter/tag
    const versionRegex = /v?(\d+\.\d+\.\d+[a-z0-9-]*)/;
    const match = commitMessage.match(versionRegex);

    if (match && match[1]) {
        const newVersion = match[1];
        console.log(`Found version in commit: ${newVersion}`);

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        if (packageJson.version !== newVersion) {
            console.log(`Updating package.json version from ${packageJson.version} to ${newVersion}`);
            packageJson.version = newVersion;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
            console.log('package.json updated successfully.');
        } else {
            console.log('Version in package.json is already up to date.');
        }
    } else {
        console.log('No version string found in the latest commit message. Skipping version update.');
    }
} catch (error) {
    console.log('[build] Git version metadata is unavailable; keeping the existing package version.');
}
