import { expect } from 'chai';
import { WebSocket } from 'ws';
import { exec } from 'child_process';

// The server is expected to be running on localhost:8080 for these tests.
const wsUrl = 'ws://localhost:8080';

describe('Messaging Server', () => {
    let serverProcess;

    // Before all tests, start the server
    before((done) => {
        console.log('Starting server for tests...');
        serverProcess = exec('npm start', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return done(error);
            }
        });

        // Give the server a moment to start up
        setTimeout(done, 2000);
    });

    // After all tests, stop the server
    after(() => {
        console.log('Stopping server...');
        serverProcess.kill('SIGINT');
    });

    it('should allow a client to connect and receive a registration success message', (done) => {
        const ws = new WebSocket(wsUrl);

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            expect(message.type).to.equal('register-success');
            expect(message.id).to.be.a('string');
            ws.close();
            done();
        });
    });
});