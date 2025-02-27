/*!
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import got from 'got'
import globals from '../extensionGlobals'
import { getLogger } from '../logger/logger'
import { getCodeCatalystDevEnvId } from '../vscode/env'

const environmentAuthToken = '__MDE_ENV_API_AUTHORIZATION_TOKEN'
const environmentEndpoint = 'http://127.0.0.1:1339'

/**
 * Client to the MDE quasi-IMDS localhost endpoint.
 */
export class DevEnvClient implements vscode.Disposable {
    static #instance: DevEnvClient
    private readonly timer
    private lastStatus = ''
    private onStatusChangeFn: undefined | ((oldStatus: string, newStatus: string) => void)

    /** Singleton instance (to avoid multiple polling workers). */
    public static get instance() {
        return (this.#instance ??= new this())
    }

    /** @internal */
    public constructor(private readonly endpoint: string = environmentEndpoint) {
        if (!this.id) {
            getLogger().debug('codecatalyst: DevEnvClient skipped (local)')
            this.timer = undefined
        } else {
            getLogger().info('codecatalyst: DevEnvClient started')
            this.timer = globals.clock.setInterval(async () => {
                const r = await this.getStatus()
                if (this.lastStatus !== r.status) {
                    const newStatus = r.status ?? 'NULL'
                    getLogger().info(
                        'codecatalyst: DevEnvClient: status change (old=%s new=%s)%s%s',
                        this.lastStatus,
                        newStatus,
                        r.actionId ? ` action=${r.actionId}` : '',
                        r.message ? `: "${r.message}"` : ''
                    )
                    if (this.onStatusChangeFn) {
                        this.onStatusChangeFn(this.lastStatus, newStatus)
                    }
                    this.lastStatus = newStatus ?? 'NULL'
                }
            }, 1000)
        }
    }

    public onStatusChange(fn: (oldStatus: string, newStatus: string) => void) {
        this.onStatusChangeFn = fn
    }

    public dispose() {
        if (this.timer) {
            globals.clock.clearInterval(this.timer)
        }
    }

    public get id(): string | undefined {
        return getCodeCatalystDevEnvId()
    }

    public isCodeCatalystDevEnv(): boolean {
        return !!this.id
    }

    // Start an action
    public async startDevfile(request: StartDevfileRequest): Promise<void> {
        await this.got.post('start', { json: request })
    }

    // Create a devfile for the project
    public async createDevfile(request: CreateDevfileRequest): Promise<CreateDevfileResponse> {
        const response = await this.got.post<CreateDevfileResponse>('devfile/create', { json: request })

        return response.body
    }

    // Get status and action type
    //
    // Example:
    //      { status: 'IMAGES-UPDATE-AVAILABLE', location: 'devfile.yaml' }
    public async getStatus(): Promise<GetStatusResponse> {
        const response = await this.got<GetStatusResponse>('status')

        return response.body
    }

    private get authToken(): string | undefined {
        return process.env[environmentAuthToken]
    }

    private readonly got = got.extend({
        prefixUrl: this.endpoint,
        responseType: 'json',
        // `Authorization` _should_ have two parameters (RFC 7235), MDE should probably fix that
        headers: { Authorization: this.authToken },
    })
}

export interface GetStatusResponse {
    actionId?: string
    message?: string
    status?: Status
    location?: string // relative to the currently mounted project
}

export interface CreateDevfileRequest {
    path?: string
}

export interface CreateDevfileResponse {
    // Location of the created devfile.
    location?: string
}

export interface StartDevfileRequest {
    // The devfile.yaml file path relative to /projects/
    location?: string

    // The home volumes will be deleted and created again with the content of the '/home' folder of each component container.
    recreateHomeVolumes?: boolean
}

export type Status =
    | 'PENDING'
    | 'STABLE'
    | 'CHANGED'
    /**
     * The image on-disk in the DE is different from the one in the container registry.
     * Client should call "/devfile/pull" to pull the latest image from the registry.
     */
    | 'IMAGES-UPDATE-AVAILABLE'
