/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'assert'
import { createFolderCommand } from '../../../s3/commands/createFolder'
import { S3BucketNode } from '../../../s3/explorer/s3BucketNode'
import { S3Node } from '../../../s3/explorer/s3Nodes'
import { S3Client } from '../../../shared/clients/s3Client'
import { FakeCommands } from '../../shared/vscode/fakeCommands'
import { getTestWindow } from '../../shared/vscode/window'
import { anything, mock, instance, when, deepEqual } from '../../utilities/mockito'

describe('createFolderCommand', function () {
    const invalidFolderNames: { folderName: string; error: string }[] = [
        { folderName: 'contains/delimiter', error: `Folder name must not contain '/'` },
        { folderName: '', error: 'Folder name must not be empty' },
    ]

    const folderName = 'foo'
    const folderPath = 'foo/'
    const bucketName = 'bucket-name'

    let s3: S3Client
    let node: S3BucketNode

    beforeEach(function () {
        s3 = mock()
        node = new S3BucketNode(
            { name: bucketName, region: 'region', arn: 'arn' },
            new S3Node(instance(s3)),
            instance(s3)
        )
    })

    it('prompts for folder name, creates folder, shows success, and refreshes node', async function () {
        when(s3.createFolder(deepEqual({ path: folderPath, bucketName }))).thenResolve({
            folder: { name: folderName, path: folderPath, arn: 'arn' },
        })

        getTestWindow().onDidShowInputBox(input => {
            assert.strictEqual(input.prompt, 'Enter a folder to create in s3://bucket-name')
            assert.strictEqual(input.placeholder, 'Folder Name')
            input.acceptValue(folderName)
        })
        const commands = new FakeCommands()
        await createFolderCommand(node, commands)

        getTestWindow()
            .getFirstMessage()
            .assertInfo(/Created folder: foo/)

        assert.strictEqual(commands.command, 'aws.refreshAwsExplorerNode')
        assert.deepStrictEqual(commands.args, [node])
    })

    it('does nothing when prompt is cancelled', async function () {
        getTestWindow().onDidShowInputBox(input => input.hide())
        await assert.rejects(() => createFolderCommand(node, new FakeCommands()), /cancelled/i)
    })

    it('shows an error message and refreshes node when folder creation fails', async function () {
        when(s3.createFolder(anything())).thenReject(new Error('Expected failure'))

        getTestWindow().onDidShowInputBox(input => input.acceptValue(folderName))
        const commands = new FakeCommands()
        await assert.rejects(() => createFolderCommand(node, commands), /failed to create folder/i)

        assert.strictEqual(commands.command, 'aws.refreshAwsExplorerNode')
        assert.deepStrictEqual(commands.args, [node])
    })

    invalidFolderNames.forEach(invalid => {
        it(`warns '${invalid.error}' when folder name is '${invalid.folderName}'`, async () => {
            getTestWindow().onDidShowInputBox(input => {
                input.acceptValue(invalid.folderName)
                assert.strictEqual(input.validationMessage, invalid.error)
                input.hide()
            })
            const commands = new FakeCommands()
            await assert.rejects(() => createFolderCommand(node, commands))
        })
    })
})
