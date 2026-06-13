#!/usr/bin/env node

/* =====================================================
   Face Threshold Calibration

   Expected dataset:
   datasets/face-calibration/<pegawai>/master/*.json
   datasets/face-calibration/<pegawai>/test/same_*.json
   datasets/face-calibration/<pegawai>/test/impostor_*.json

   Each JSON file must be either a 128-number descriptor array or:
   { "descriptor": [128 numbers] }
   ===================================================== */

const fs = require('fs');
const path = require('path');
const {
    FACE_MATCH_THRESHOLD,
    normalizeFaceSample,
    matchAgainstEmbeddings
} = require('../utils/face-match');

const datasetDir = process.argv[2] || path.join(process.cwd(), 'datasets', 'face-calibration');
const thresholds = [0.4, 0.45, 0.5, 0.55, 0.6];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(dir, file));
}

function readDescriptor(filePath) {
    const sample = normalizeFaceSample(readJson(filePath));
    if (!sample) {
        throw new Error(`Descriptor tidak valid: ${filePath}`);
    }
    return sample.descriptor;
}

function loadEmployeeCase(employeeDir) {
    const masterDir = path.join(employeeDir, 'master');
    const testDir = path.join(employeeDir, 'test');

    return {
        name: path.basename(employeeDir),
        masters: listJsonFiles(masterDir).map(readDescriptor),
        same: listJsonFiles(testDir)
            .filter((file) => path.basename(file).startsWith('same_'))
            .map(readDescriptor),
        impostors: listJsonFiles(testDir)
            .filter((file) => path.basename(file).startsWith('impostor_'))
            .map(readDescriptor)
    };
}

function evaluateCase(employeeCase, threshold) {
    let sameTotal = 0;
    let sameRejected = 0;
    let impostorTotal = 0;
    let impostorAccepted = 0;

    employeeCase.same.forEach((descriptor) => {
        sameTotal += 1;
        const result = matchAgainstEmbeddings(descriptor, employeeCase.masters, threshold);
        if (!result?.match) sameRejected += 1;
    });

    employeeCase.impostors.forEach((descriptor) => {
        impostorTotal += 1;
        const result = matchAgainstEmbeddings(descriptor, employeeCase.masters, threshold);
        if (result?.match) impostorAccepted += 1;
    });

    return { sameTotal, sameRejected, impostorTotal, impostorAccepted };
}

function percent(part, total) {
    if (!total) return '0.0%';
    return `${((part / total) * 100).toFixed(1)}%`;
}

function main() {
    if (!fs.existsSync(datasetDir)) {
        console.error(`Dataset tidak ditemukan: ${datasetDir}`);
        console.error('Buat folder datasets/face-calibration atau berikan path sebagai argumen.');
        process.exit(1);
    }

    const employeeCases = fs.readdirSync(datasetDir)
        .map((name) => path.join(datasetDir, name))
        .filter((entry) => fs.statSync(entry).isDirectory())
        .map(loadEmployeeCase)
        .filter((entry) => entry.masters.length > 0);

    if (employeeCases.length === 0) {
        console.error('Tidak ada data master descriptor yang bisa dikalibrasi.');
        process.exit(1);
    }

    console.log(`Dataset: ${datasetDir}`);
    console.log(`Pegawai: ${employeeCases.length}`);
    console.log(`Threshold default saat ini: ${FACE_MATCH_THRESHOLD}`);
    console.log('');

    thresholds.forEach((threshold) => {
        const total = employeeCases.reduce((acc, employeeCase) => {
            const result = evaluateCase(employeeCase, threshold);
            acc.sameTotal += result.sameTotal;
            acc.sameRejected += result.sameRejected;
            acc.impostorTotal += result.impostorTotal;
            acc.impostorAccepted += result.impostorAccepted;
            return acc;
        }, { sameTotal: 0, sameRejected: 0, impostorTotal: 0, impostorAccepted: 0 });

        console.log(`Threshold ${threshold.toFixed(2)}:`);
        console.log(`- False reject: ${percent(total.sameRejected, total.sameTotal)} (${total.sameRejected}/${total.sameTotal})`);
        console.log(`- False accept: ${percent(total.impostorAccepted, total.impostorTotal)} (${total.impostorAccepted}/${total.impostorTotal})`);
        console.log('');
    });
}

main();
