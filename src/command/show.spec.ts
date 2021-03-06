import * as fs from 'fs';
import * as temp from 'temp';
import * as Path from 'path';
import { stage } from './stage';
import { expect } from 'chai';
import { getStatus } from './status';
import { createCommit } from './commit';
import { logCommitSHAs } from './log';
import { createTestRepository } from './test-helper';
import { getTextContents } from './show';
const track = temp.track();

describe('show', async () => {

    after(async () => {
        track.cleanupSync();
    });

    it('diff', async () => {
        const repositoryPath = track.mkdirSync('test-repo-path');
        await createTestRepository(repositoryPath);
        const fileName = Path.join(repositoryPath, 'A.txt');

        fs.writeFileSync(fileName, 'second commit', { encoding: 'utf8' });
        expect(fs.readFileSync(fileName, { encoding: 'utf8' })).to.be.equal('second commit');
        await stage(repositoryPath, fileName);
        expect((await getStatus(repositoryPath)).workingDirectory.files.filter(f => f.staged)).to.be.lengthOf(1);
        await createCommit(repositoryPath, 'second');
        expect((await getStatus(repositoryPath)).workingDirectory.files.filter(f => f.staged)).to.be.empty;

        fs.writeFileSync(fileName, 'third commit', { encoding: 'utf8' });
        expect(fs.readFileSync(fileName, { encoding: 'utf8' })).to.be.equal('third commit');
        await stage(repositoryPath, fileName);
        expect((await getStatus(repositoryPath)).workingDirectory.files.filter(f => f.staged)).to.be.lengthOf(1);
        await createCommit(repositoryPath, 'third');
        expect((await getStatus(repositoryPath)).workingDirectory.files.filter(f => f.staged)).to.be.empty;

        let SHAs = await logCommitSHAs(repositoryPath, fileName);
        expect(SHAs).to.be.lengthOf(3);
        let [HEAD, second, first] = SHAs;
        expect((await getTextContents(repositoryPath, HEAD, fileName)).toString()).to.be.equal('third commit');
        expect((await getTextContents(repositoryPath, second, fileName)).toString()).to.be.equal('second commit');
        expect((await getTextContents(repositoryPath, first, fileName)).toString()).to.be.equal('A');
        expect((await getTextContents(repositoryPath, 'HEAD', fileName)).toString()).to.be.equal('third commit');

        fs.writeFileSync(fileName, 'just staged', { encoding: 'utf8' });
        expect(fs.readFileSync(fileName, { encoding: 'utf8' })).to.be.equal('just staged');
        await stage(repositoryPath, fileName);
        expect((await getStatus(repositoryPath)).workingDirectory.files.filter(f => f.staged)).to.be.lengthOf(1);
        fs.writeFileSync(fileName, 'changed but un-staged', { encoding: 'utf8' });
        expect(fs.readFileSync(fileName, { encoding: 'utf8' })).to.be.equal('changed but un-staged');

        SHAs = await logCommitSHAs(repositoryPath, fileName);
        expect(SHAs).to.be.lengthOf(3);
        [HEAD, second, first] = SHAs;
        expect((await getTextContents(repositoryPath, HEAD, fileName)).toString()).to.be.equal('third commit');
        expect((await getTextContents(repositoryPath, second, fileName)).toString()).to.be.equal('second commit');
        expect((await getTextContents(repositoryPath, first, fileName)).toString()).to.be.equal('A');
        expect((await getTextContents(repositoryPath, 'HEAD', fileName)).toString()).to.be.equal('third commit');
        expect((await getTextContents(repositoryPath, 'HEAD~1', fileName)).toString()).to.be.equal('second commit');
        expect((await getTextContents(repositoryPath, 'HEAD~2', fileName)).toString()).to.be.equal('A');
        expect((await getTextContents(repositoryPath, `${HEAD}~1`, fileName)).toString()).to.be.equal('second commit');
        expect((await getTextContents(repositoryPath, `${HEAD}~2`, fileName)).toString()).to.be.equal('A');
        expect((await getTextContents(repositoryPath, '', fileName)).toString()).to.be.equal('just staged');

        const nestedFileName = Path.join(repositoryPath, 'folder', 'C.txt');
        expect(fs.readFileSync(nestedFileName, { encoding: 'utf8' })).to.be.equal('C');
        expect((await getTextContents(repositoryPath, 'HEAD', nestedFileName)).toString()).to.be.equal('C');
        fs.writeFileSync(nestedFileName, 'some other content', { encoding: 'utf8' });
        expect(fs.readFileSync(nestedFileName, { encoding: 'utf8' })).to.be.equal('some other content');
        expect((await getTextContents(repositoryPath, 'HEAD', nestedFileName)).toString()).to.be.equal('C');
        expect((await getTextContents(repositoryPath, '', nestedFileName)).toString()).to.be.equal('C');
        await stage(repositoryPath, nestedFileName);
        expect((await getTextContents(repositoryPath, 'HEAD', nestedFileName)).toString()).to.be.equal('C');
        expect((await getTextContents(repositoryPath, '', nestedFileName)).toString()).to.be.equal('some other content');
    });

});