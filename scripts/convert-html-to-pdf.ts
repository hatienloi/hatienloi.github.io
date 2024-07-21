const { spawn } = require('child_process');
const FormData = require('form-data');
import axios from 'axios';
import { createReadStream } from 'fs';

const now = Date.now();
const cvPath = 'cv.html';
const output = 'public/CV-HaTienLoi.pdf';
const webpage = `${now}-cvhtml.webpage`;
const commonHeaders = {
    origin: 'https://www.freeconvert.com',
    referer: 'https://www.freeconvert.com/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

async function sh(command, args) {
    const p = spawn(command, args);
    return new Promise((resolveFunc) => {
        p.stdout.on('data', (x) => {
            process.stdout.write(x.toString());
        });
        p.stderr.on('data', (x) => {
            process.stderr.write(x.toString());
        });
        p.on('exit', (code) => {
            resolveFunc(code);
        });
    });
}

const log = (text: string, newLine = false) => {
    console.log(`################# ${text} ##################${newLine ? '\n' : ''}`);
};

const sleep = async (number: number) => {
    await new Promise((r) => setTimeout(r, number));
};

const createJob = async () => {
    const data = JSON.stringify({
        tasks: {
            import: {
                operation: 'import/upload',
            },
            convert: {
                operation: 'convert',
                input: 'import',
                input_format: 'webpage',
                output_format: 'pdf',
                options: {
                    page_size: 'a4',
                    page_orientation: 'portrait',
                    margin: '50',
                    initial_delay: '3',
                    hide_cookie: true,
                    use_print_stylesheet: true,
                },
                type: 'webpage',
            },
            'export-url': {
                operation: 'export/url',
                input: 'convert',
            },
        },
    });

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.freeconvert.com/v1/process/jobs',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            ...commonHeaders,
        },
        data,
    };
    try {
        log(`Creating Job`);
        const resp = await axios.request(config);
        const data = resp.data;
        const tasks = data.tasks;
        const importUploadJob = tasks[0];
        const jobId = importUploadJob.id;
        const formUrl = importUploadJob.result.form.url;
        const regex = /https?:\/\/server(\d+\-).*?com/;
        const serverUrl =
            regex.exec(formUrl)?.[0]?.toString()?.replace('server', 's') || '';
        const signature = importUploadJob.result.form.parameters.signature;
        const exportTask = tasks.find((v) => v.name === 'export-url');
        const exportId = exportTask.id;
        log(`DONE`, true);
        return { jobId, signature, serverUrl, exportId };
    } catch (error) {
        throw new Error(`createJob error: ${error}`);
    }
};

const resumableJob = async (jobId: string, serverUrl: string) => {
    const data = new FormData();
    data.append('resumableChunkNumber', '1');
    data.append('resumableType', 'text/html');
    data.append('resumableIdentifier', webpage);
    data.append('resumableFilename', cvPath);
    data.append('resumableRelativePath', cvPath);
    data.append('resumableTotalChunks', '1');
    data.append('file', createReadStream(cvPath));

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${serverUrl}/api/resumable/${jobId}`,
        params: {
            resumableType: 'text/html',
            resumableIdentifier: webpage,
            resumableFilename: cvPath,
            resumableRelativePath: cvPath,
            resumableTotalChunks: '1'
        },
        headers: {
            ...commonHeaders,
            ...data.getHeaders(),
        },
        data,
    };
    try {
        log(`Uploading file to Job`);
        const resp = await axios.request(config);
        const data = resp.data;
        if (data.fileUploadStatus !== 'done') {
            throw new Error('Failed to join. ');
        }
        log(`DONE`, true);
    } catch (error) {
        throw new Error(`resumableJob error: ${error}`);
    }
};

const joinJob = async (jobId: string, serverUrl: string) => {
    const data = new FormData();
    data.append('identifier', webpage);

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${serverUrl}/api/resumable/join/${jobId}`,
        headers: {
            ...commonHeaders,
            ...data.getHeaders(),
        },
        data: data,
    };
    try {
        log(`Starting Job`);
        const resp = await axios.request(config);
        const data = resp.data;
        log(`DONE`, true);
    } catch (error) {
        throw new Error(`joinJob error: ${error}`);
    }
};

const uploadFile = async (
    jobId: string,
    signature: string,
    serverUrl: string
) => {
    const data = new FormData();
    data.append('identifier', webpage);
    data.append('fileName', cvPath);
    data.append('signature', signature);
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${serverUrl}/api/upload/${jobId}`,
        headers: {
            ...commonHeaders,
            ...data.getHeaders(),
        },
        data,
    };
    try {
        log(`Converting file`);
        const resp = await axios.request(config);
        const data = resp.data;
        if (data.msg !== 'ok') {
            throw new Error('Failed to uploadFile. ');
        }
        log(`DONE`, true);
    } catch (error) {
        throw new Error(`uploadFile error: ${error}`);
    }
};

const downloadFile = async (serverUrl: string, exportId: string) => {
    const url = `${serverUrl}/task/${exportId}/cv.pdf`;
    const config = {
        method: 'head',
        maxBodyLength: Infinity,
        url: url,
        headers: {},
    };
    let retry = 1;
    const maxRetry = 20;
    log('Downloading file');

    while (retry < maxRetry) {
        try {
            const resp = await axios.request(config);
            if (resp.status === 200) {
                await sh('curl', [url, '-o', output]);
                log(`DONE`, true);
                return;
            }
        } catch (error) {
            // console.log(`Error download: ${error}`);
        }
        await sleep(1000);
        retry += 1;
    }
};

const main = async () => {
    const { jobId, signature, serverUrl, exportId } = await createJob();
    await sleep(2000);
    await resumableJob(jobId, serverUrl);
    await sleep(2000);
    await joinJob(jobId, serverUrl);
    await sleep(2000);
    await uploadFile(jobId, signature, serverUrl);
    await sleep(2000);
    await downloadFile(serverUrl, exportId);
};

main();
