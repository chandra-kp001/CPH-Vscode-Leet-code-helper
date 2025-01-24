const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Alfa LeetCode API endpoint
const ALFA_API_URL = 'https://alfa-leetcode-api.onrender.com';

// Regular expressions to extract input and output
const inputRegex = /<strong>Input:<\/strong>\s*([\s\S]*?)(?=<strong>Output:<\/strong>|<strong>Explanation:<\/strong>|$)/g;
const outputRegex = /<strong>Output:<\/strong>\s*([\s\S]*?)(?=<strong>Explanation:<\/strong>|<\/pre>)/g;

let lastUrl = null;

// Function to fetch test cases using alfa-leetcode-api
const fetchTestCases = async (slug) => {
  try {
    const response = await axios.get(`${ALFA_API_URL}/select?titleSlug=${slug}`);
    const { question } = response.data;

    // Print the full question
    console.log("Question:", question);

    // Extract inputs and outputs using regex
    const inputs = [];
    const outputs = [];
    let inputMatch, outputMatch;

    while ((inputMatch = inputRegex.exec(question)) !== null) {
      inputs.push(inputMatch[1].trim());
    }

    while ((outputMatch = outputRegex.exec(question)) !== null) {
      outputs.push(outputMatch[1].trim());
    }

    console.log(`Fetched ${inputs.length} inputs and ${outputs.length} outputs`);

    // Directory to store files
    const workspaceFolder = vscode.workspace.rootPath || vscode.env.appRoot;
    const testCasesDir = path.join(workspaceFolder, 'test_cases', slug);
    if (!fs.existsSync(testCasesDir)) fs.mkdirSync(testCasesDir, { recursive: true });

    // Save the extracted inputs and outputs as files
    inputs.forEach((input, index) => {
      fs.writeFileSync(path.join(testCasesDir, `ip${index + 1}.txt`), input);
      fs.writeFileSync(path.join(testCasesDir, `op${index + 1}.txt`), outputs[index]);
    });

    console.log('Test cases saved!');
    vscode.window.showInformationMessage(`Test cases for ${slug} have been saved!`);

  } catch (error) {
    vscode.window.showErrorMessage(`Error fetching test cases: ${error.message}`);
  }
};

// Extract problem slug from URL
const extractSlugFromURL = (url) => {
  const match = url.match(/\/problems\/([a-z0-9-]+)/);
  if (match && match[1]) return match[1];
  throw new Error('Invalid LeetCode URL');
};

// Command to fetch test cases
const fetchTestCasesCommand = async () => {
  try {
    const url = await vscode.window.showInputBox({
      placeHolder: 'Enter the LeetCode problem URL',
      prompt: 'Example: https://leetcode.com/problems/two-sum/',
    });

    if (!url) return vscode.window.showErrorMessage('LeetCode problem URL is required');

    lastUrl = url;
    const slug = extractSlugFromURL(url);
    vscode.window.showInformationMessage(`Fetching test cases for problem: ${slug}`);
    await fetchTestCases(slug);

  } catch (error) {
    vscode.window.showErrorMessage('Error: ' + error.message);
  }
};

// Command to run test cases
const runTestCasesCommand = async () => {
  const outputChannel = vscode.window.createOutputChannel('Test Cases Output');
  outputChannel.show();

  try {
    if (!lastUrl) return vscode.window.showErrorMessage('Fetch test cases first');

    const slug = extractSlugFromURL(lastUrl);
    const testCaseFolderPath = path.join(vscode.workspace.rootPath || vscode.env.appRoot, 'test_cases', slug);

    if (!fs.existsSync(testCaseFolderPath)) {
      return vscode.window.showErrorMessage(`No test cases found for problem: ${slug}`);
    }

    const files = fs.readdirSync(testCaseFolderPath);
    const inputFiles = files.filter(file => file.startsWith('ip') && file.endsWith('.txt'));
    const outputFiles = files.filter(file => file.startsWith('op') && file.endsWith('.txt'));

    if (inputFiles.length !== outputFiles.length) {
      return vscode.window.showErrorMessage('Mismatch between the number of input and output files');
    }

    const inputs = inputFiles.map(file => fs.readFileSync(path.join(testCaseFolderPath, file), 'utf-8').trim());
    const expectedOutputs = outputFiles.map(file => fs.readFileSync(path.join(testCaseFolderPath, file), 'utf-8').trim());

    const solutionFilePath = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      openLabel: 'Select your solution file',
      filters: {
        'Python Files': ['py'],
        'C++ Files': ['cpp'],
        'JavaScript Files': ['js'],
      },
    });

    if (!solutionFilePath || solutionFilePath.length === 0) {
      return vscode.window.showErrorMessage('Solution file is required');
    }

    const solutionPath = solutionFilePath[0].fsPath;
    const fileExtension = path.extname(solutionPath);
    console.log(`Selected solution file path: ${solutionPath}`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const expectedOutput = expectedOutputs[i];

      console.log(`Running test case ${i + 1} with input: ${input}`);
      console.log(`Expected output: ${expectedOutput}`);

      let execCommand = '';
      let execOptions = {};

      switch (fileExtension) {
        case '.py': 
          execCommand = `python ${solutionPath}`;
          execOptions = { input };
          break;

        case '.js': 
          execCommand = `node ${solutionPath}`;
          execOptions = { input };
          break;

        case '.cpp': 
          execCommand = `g++ ${solutionPath} -o solution && ./solution`;
          break;

        default:
          return vscode.window.showErrorMessage('Unsupported file type');
      }

      exec(execCommand, execOptions, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running test case ${i + 1}: ${stderr}`);
          outputChannel.appendLine(`Error running test case ${i + 1}: ${stderr}`);
        } else {
          const actualOutput = stdout.trim();
          if (actualOutput === expectedOutput) {
            outputChannel.appendLine(`Test case ${i + 1} PASSED!`);
          } else {
            outputChannel.appendLine(`Test case ${i + 1} FAILED!`);
            outputChannel.appendLine(`Expected: ${expectedOutput}`);
            outputChannel.appendLine(`Received: ${actualOutput}`);
          }
        }
      });
    }
  } catch (error) {
    outputChannel.appendLine(`Error: ${error.message}`);
    console.error(`Error: ${error.message}`);
  }
};

// Activate function
function activate(context) {
  let fetchTestCasesDisposable = vscode.commands.registerCommand('lc-problem-solver.fetchTestCasesCommand', fetchTestCasesCommand);
  let runTestCasesDisposable = vscode.commands.registerCommand('lc-problem-solver.runTestCasesCommand', runTestCasesCommand);
  
  context.subscriptions.push(fetchTestCasesDisposable);
  context.subscriptions.push(runTestCasesDisposable);
}

exports.activate = activate;
