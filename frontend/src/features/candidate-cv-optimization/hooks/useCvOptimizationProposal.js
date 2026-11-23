import { useCallback, useEffect, useRef, useState } from 'react'

import {
  commitOptimizedCandidateCvProposalForJobApi,
  previewOptimizedCandidateCvForJobApi,
} from '@/apis/candidate-cv-optimization.api'

import { toOptimizeEvaluationPayload } from '../utils'

const INITIAL_STATE = Object.freeze({
  previewStatus: 'idle',
  commitStatus: 'idle',
  preview: null,
  draftCv: null,
  previewError: null,
  commitError: null,
})

// Backend rejects an unusable Proposal (malformed/signature/expired 400,
// identity 403, Source changed or archived 409, missing 404); retrying the same
// Proposal cannot succeed, so it is discarded. Transport/5xx errors keep it.
const PROPOSAL_REJECTED_STATUSES = new Set([400, 403, 404, 409])

// AI-V06 F03/F04 client state: Preview -> signed Proposal -> Commit. The
// Proposal is stored and committed untouched; it is cleared whenever the Source
// CV or Job changes so a stale Proposal can never be committed.
function useCvOptimizationProposal({ jobId, candidateCvId } = {}) {
  const [state, setState] = useState(INITIAL_STATE)
  const contextKey = `${jobId ?? ''}|${candidateCvId ?? ''}`
  const contextRef = useRef(contextKey)
  const proposalRef = useRef(null)
  const committingRef = useRef(false)

  const clear = useCallback(() => {
    proposalRef.current = null
    committingRef.current = false
    setState(INITIAL_STATE)
  }, [])

  useEffect(() => {
    contextRef.current = contextKey
    clear()
  }, [contextKey, clear])

  const requestPreview = useCallback(async (evaluationResult) => {
    if (!jobId || !candidateCvId || !evaluationResult) {
      return null
    }

    const requestContext = contextRef.current
    proposalRef.current = null
    setState({ ...INITIAL_STATE, previewStatus: 'loading' })

    try {
      const response = await previewOptimizedCandidateCvForJobApi({
        jobId,
        candidateCvId,
        evaluationResult: toOptimizeEvaluationPayload(evaluationResult),
      })
      if (contextRef.current !== requestContext) {
        return null
      }
      proposalRef.current = response.proposal
      setState({ ...INITIAL_STATE, previewStatus: 'ready', preview: response })
      return response
    } catch (error) {
      if (contextRef.current === requestContext) {
        setState({ ...INITIAL_STATE, previewStatus: 'error', previewError: error })
      }
      throw error
    }
  }, [jobId, candidateCvId])

  const commit = useCallback(async () => {
    const proposal = proposalRef.current
    if (!proposal || committingRef.current) {
      return null
    }

    const requestContext = contextRef.current
    committingRef.current = true
    setState((current) => ({ ...current, commitStatus: 'loading', commitError: null }))

    try {
      const response = await commitOptimizedCandidateCvProposalForJobApi({
        jobId,
        proposal,
      })
      if (contextRef.current !== requestContext) {
        return null
      }
      // A Proposal creates at most one Draft; consume it on success.
      proposalRef.current = null
      const draftCv = response.cv ?? null
      setState((current) => ({
        ...current,
        commitStatus: 'success',
        preview: null,
        draftCv,
      }))
      return draftCv
    } catch (error) {
      if (contextRef.current === requestContext) {
        const rejected = PROPOSAL_REJECTED_STATUSES.has(error?.status)
        if (rejected) {
          proposalRef.current = null
        }
        setState((current) => ({
          ...current,
          commitStatus: 'error',
          commitError: error,
          preview: rejected ? null : current.preview,
          previewStatus: rejected ? 'idle' : current.previewStatus,
        }))
      }
      throw error
    } finally {
      committingRef.current = false
    }
  }, [jobId])

  return {
    ...state,
    proposal: state.preview?.proposal ?? null,
    previewing: state.previewStatus === 'loading',
    committing: state.commitStatus === 'loading',
    requestPreview,
    commit,
    reset: clear,
  }
}

export default useCvOptimizationProposal
