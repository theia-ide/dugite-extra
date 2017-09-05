import { git } from '../core/git'
import { RepositoryPath } from '../model/repository';
import { parsePorcelainStatus, mapStatus } from '../parser/status-parser'
import { DiffSelectionType, DiffSelection } from '../model/diff'
import { IStatusResult, IAheadBehind, WorkingDirectoryStatus, WorkingDirectoryFileChange, AppFileStatus, FileEntry, GitStatusEntry } from '../model/status'

function convertToAppStatus(status: FileEntry): AppFileStatus {
    if (status.kind === 'ordinary') {
        switch (status.type) {
            case 'added':
                return AppFileStatus.New
            case 'modified':
                return AppFileStatus.Modified
            case 'deleted':
                return AppFileStatus.Deleted
        }
    } else if (status.kind === 'copied') {
        return AppFileStatus.Copied
    } else if (status.kind === 'renamed') {
        return AppFileStatus.Renamed
    } else if (status.kind === 'conflicted') {
        return AppFileStatus.Conflicted
    } else if (status.kind === 'untracked') {
        return AppFileStatus.New
    }

    throw new Error(`Unknown file status ${status}`)
}

function convertToStagedFlag(statusCode: string): boolean {
    // For instance, when the status code is '?', or '.M', the the files are unstaged.
    // When the status code is one of the followings: 'A.', or 'M.', the it is staged.
    return statusCode.trim().endsWith('.');
}

/**
 *  Retrieve the status for a given repository,
 *  and fail gracefully if the location is not a Git repository
 */
export async function getStatus(
    repository: RepositoryPath
): Promise<IStatusResult> {
    const result = await git(
        ['status', '--untracked-files=all', '--branch', '--porcelain=2', '-z'],
        RepositoryPath.getPath(repository),
        'getStatus'
    )

    const files = new Array<WorkingDirectoryFileChange>()

    let currentBranch: string | undefined = undefined
    let currentUpstreamBranch: string | undefined = undefined
    let currentTip: string | undefined = undefined
    let branchAheadBehind: IAheadBehind | undefined = undefined

    for (const entry of parsePorcelainStatus(result.stdout)) {
        if (entry.kind === 'entry') {
            const status = mapStatus(entry.statusCode)

            if (status.kind === 'ordinary') {
                // when a file is added in the index but then removed in the working
                // directory, the file won't be part of the commit, so we can skip
                // displaying this entry in the changes list
                if (
                    status.index === GitStatusEntry.Added &&
                    status.workingTree === GitStatusEntry.Deleted
                ) {
                    continue
                }
            }

            if (status.kind === 'untracked') {
                // when a delete has been staged, but an untracked file exists with the
                // same path, we should ensure that we only draw one entry in the
                // changes list - see if an entry already exists for this path and
                // remove it if found
                const existingEntry = files.findIndex(p => p.path === entry.path)
                if (existingEntry > -1) {
                    files.splice(existingEntry, 1)
                }
            }

            // for now we just poke at the existing summary
            const summary = convertToAppStatus(status)
            const selection = DiffSelection.fromInitialSelection(
                DiffSelectionType.All
            )

            files.push(
                new WorkingDirectoryFileChange(
                    entry.path,
                    summary,
                    selection,
                    entry.oldPath,
                    convertToStagedFlag(entry.statusCode)
                )
            )
        } else if (entry.kind === 'header') {
            let m: RegExpMatchArray | null
            const value = entry.value

            // This intentionally does not match branch.oid initial
            if ((m = value.match(/^branch\.oid ([a-f0-9]+)$/))) {
                currentTip = m[1]
            } else if ((m = value.match(/^branch.head (.*)/))) {
                if (m[1] !== '(detached)') {
                    currentBranch = m[1]
                }
            } else if ((m = value.match(/^branch.upstream (.*)/))) {
                currentUpstreamBranch = m[1]
            } else if ((m = value.match(/^branch.ab \+(\d+) -(\d+)$/))) {
                const ahead = parseInt(m[1], 10)
                const behind = parseInt(m[2], 10)

                if (!isNaN(ahead) && !isNaN(behind)) {
                    branchAheadBehind = { ahead, behind }
                }
            }
        }
    }

    const workingDirectory = new WorkingDirectoryStatus(files, true)

    return {
        currentBranch,
        currentTip,
        currentUpstreamBranch,
        branchAheadBehind,
        exists: true,
        workingDirectory,
    }
}