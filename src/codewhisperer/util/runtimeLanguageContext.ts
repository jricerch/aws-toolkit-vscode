/*!
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { CodewhispererLanguage } from '../../shared/telemetry/telemetry.gen'
import { createConstantMap, ConstantMap } from '../../shared/utilities/tsUtils'
import * as codewhispererClient from '../client/codewhisperer'
import * as CodeWhispererConstants from '../models/constants'

export class RuntimeLanguageContext {
    /**
     * A map storing cwspr supporting programming language with key: vscLanguageId and value: cwsprLanguageId
     * Key: vscLanguageId
     * Value: CodeWhispererLanguageId
     */
    private supportedLanguageMap: ConstantMap<CodeWhispererConstants.SupportedLanguage, CodewhispererLanguage>

    // A set contains vscode languageId and CodeWhispererLanguage
    private supportedLanguageSet = new Set<string>()

    constructor() {
        this.supportedLanguageMap = createConstantMap<CodeWhispererConstants.SupportedLanguage, CodewhispererLanguage>({
            java: 'java',
            python: 'python',
            javascriptreact: 'jsx',
            javascript: 'javascript',
            typescript: 'typescript',
            typescriptreact: 'tsx',
            csharp: 'csharp',
            c: 'c',
            cpp: 'cpp',
            go: 'go',
            kotlin: 'kotlin',
            php: 'php',
            ruby: 'ruby',
            rust: 'rust',
            scala: 'scala',
            shellscript: 'shell',
            sql: 'sql',
        })

        const values = Array.from(this.supportedLanguageMap.values())
        const keys = Array.from(this.supportedLanguageMap.keys())
        values.forEach(item => this.supportedLanguageSet.add(item))
        keys.forEach(item => this.supportedLanguageSet.add(item))
    }

    /**
     *
     * @param vscLanguageId : official vscode languageId
     * @returns corresponding CodewhispererLanguage ID if any, otherwise undefined
     */
    public mapVscLanguageToCodeWhispererLanguage(vscLanguageId?: string): CodewhispererLanguage | undefined {
        return this.supportedLanguageMap.get(vscLanguageId) ?? undefined
    }

    /**
     * @param vscLanguageId : official vscode languageId
     * @returns An object with a field language: CodewhispererLanguage, if no corresponding CodewhispererLanguage ID, plaintext is returned
     */
    public getLanguageContext(vscLanguageId?: string): { language: CodewhispererLanguage } {
        return { language: this.mapVscLanguageToCodeWhispererLanguage(vscLanguageId) ?? 'plaintext' }
    }

    /**
     * Mapping the field ProgrammingLanguage of codewhisperer generateRecommendationRequest | listRecommendationRequest to
     * its Codewhisperer runtime language e.g. jsx -> typescript, typescript -> typescript
     * @param request : cwspr generateRecommendationRequest | ListRecommendationRequest
     * @returns request with source language name mapped to cwspr runtime language
     */
    public mapToRuntimeLanguage<
        T extends codewhispererClient.ListRecommendationsRequest | codewhispererClient.GenerateRecommendationsRequest
    >(request: T): T {
        const fileContext = request.fileContext
        const childLanguage = request.fileContext.programmingLanguage
        let parentLanguage: codewhispererClient.ProgrammingLanguage
        switch (childLanguage.languageName) {
            case 'tsx':
                parentLanguage = { languageName: CodeWhispererConstants.typescript }
                break
            case 'jsx':
                parentLanguage = { languageName: CodeWhispererConstants.javascript }
                break
            default:
                parentLanguage = childLanguage
                break
        }

        return {
            ...request,
            fileContext: {
                ...fileContext,
                programmingLanguage: parentLanguage,
            },
        }
    }

    /**
     *
     * @param languageId: either vscodeLanguageId or CodewhispererLanguage
     * @returns ture if the language is supported by CodeWhisperer otherwise false
     */
    public isLanguageSupported(languageId: string): boolean {
        return this.supportedLanguageSet.has(languageId)
    }
}

export const runtimeLanguageContext = new RuntimeLanguageContext()
