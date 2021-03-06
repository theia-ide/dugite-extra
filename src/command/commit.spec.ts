import * as temp from 'temp';
import * as fs from 'fs-extra';
import *  as Path from 'path';
import { expect } from 'chai';
import { createCommit } from './commit';
import { initRepository } from './test-helper';
import { git } from '../core/git';

const track = temp.track();

describe('commit', async () => {

    after(async () => {
        track.cleanupSync();
    });

    it('keeps the line breaks', async () => {
        const path = track.mkdirSync('commit-line-breaks');
        await initRepository(path);

        fs.createFileSync(Path.join(path, 'some-file.txt'));
        expect(fs.existsSync(Path.join(path, 'some-file.txt'))).to.be.true;

        const expected = `aaaa

bbbb

Signed-off-by: Akos Kitta <kittaakos@gmail.com>
`;
        expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
        await createCommit(path, expected);

        expect((await git(['log', '--format=%B'], path, 'log')).stdout.trim()).to.be.deep.equal(expected.trim())
    });

    describe('sign-off', () => {
        it('disabled', async () => {
            const path = track.mkdirSync('commit-sign-off-disabled');
            await initRepository(path);

            const userName = (await git(['config', 'user.name'], path, 'getUserName')).stdout.trim().split('"').join('');
            expect(userName).not.undefined;
            expect(userName).not.empty;

            fs.createFileSync(Path.join(path, 'some-file.txt'));
            expect(fs.existsSync(Path.join(path, 'some-file.txt'))).to.be.true;

            expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
            await createCommit(path, 'some commit message');

            expect((await git(['log', '--format=%B'], path, 'log')).stdout.trim()).to.not.contain(userName);
        });

        it('enabled', async () => {
            const path = track.mkdirSync('commit-sign-off-enabled');
            await initRepository(path);

            const userName = (await git(['config', 'user.name'], path, 'getUserName')).stdout.trim().split('"').join('');
            expect(userName).not.undefined;
            expect(userName).not.empty;

            fs.createFileSync(Path.join(path, 'some-file.txt'));
            expect(fs.existsSync(Path.join(path, 'some-file.txt'))).to.be.true;

            expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
            await createCommit(path, 'some commit message', true);

            expect((await git(['log', '--format=%B'], path, 'log')).stdout.trim()).to.contain(userName);
        });
    });

    describe('amend', () => {
        it('w/', async () => {
            const path = track.mkdirSync('commit-with-amend');
            await initRepository(path);

            fs.createFileSync(Path.join(path, 'some-file.txt'));
            expect(fs.existsSync(Path.join(path, 'some-file.txt'))).to.be.true;

            expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
            await createCommit(path, 'some commit message');
            const beforeAmendCommits = (await git(['log', '--format=%B', '-z'], path, 'log')).stdout.trim().split('\0').filter(c => c.trim().length > 0);
            expect(beforeAmendCommits).to.have.lengthOf(1);
            expect(beforeAmendCommits[0].trim().endsWith('some commit message')).to.be.true;

            fs.createFileSync(Path.join(path, 'another-file.txt'));
            expect(fs.existsSync(Path.join(path, 'another-file.txt'))).to.be.true;

            expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
            await createCommit(path, 'another message', false, true);
            const afterAmendCommits = (await git(['log', '--format=%B', '-z'], path, 'log')).stdout.trim().split('\0').filter(c => c.trim().length > 0);
            expect(afterAmendCommits).to.have.lengthOf(1);
            expect(afterAmendCommits[0].trim().endsWith('another message')).to.be.true;
        });

        it('w/o', async () => {
            const path = track.mkdirSync('commit-without-amend');
            await initRepository(path);

            fs.createFileSync(Path.join(path, 'some-file.txt'));
            expect(fs.existsSync(Path.join(path, 'some-file.txt'))).to.be.true;

            expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
            await createCommit(path, 'some commit message');
            const beforeAmendCommits = (await git(['log', '--format=%B', '-z'], path, 'log')).stdout.trim().split('\0').filter(c => c.trim().length > 0);
            expect(beforeAmendCommits).to.have.lengthOf(1);
            expect(beforeAmendCommits[0].trim().endsWith('some commit message')).to.be.true;

            fs.createFileSync(Path.join(path, 'another-file.txt'));
            expect(fs.existsSync(Path.join(path, 'another-file.txt'))).to.be.true;

            expect((await git(['add', '.'], path, 'add')).exitCode).to.be.equal(0);
            await createCommit(path, 'another message', false, false);
            const afterAmendCommits = (await git(['log', '--format=%B', '-z'], path, 'log')).stdout.trim().split('\0').filter(c => c.trim().length > 0);
            expect(afterAmendCommits).to.have.lengthOf(2);
            expect(afterAmendCommits[0].trim().endsWith('another message')).to.be.true;
            expect(afterAmendCommits[1].trim().endsWith('some commit message')).to.be.true;
        });
    })

});

