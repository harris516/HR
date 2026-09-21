import type {
  NavigationStatus,
  NavigationTask,
  NavigationTransitionRecord
} from "../contracts/navigation.js";

const allowedTransitions: Record<NavigationStatus, NavigationStatus[]> = {
  created: ["validated", "failed", "cancelled"],
  validated: ["in_progress", "blocked", "cancelled"],
  in_progress: ["waiting_for_source", "waiting_for_human", "blocked", "completed", "failed"],
  waiting_for_source: ["in_progress", "failed", "cancelled"],
  waiting_for_human: ["in_progress", "failed", "cancelled"],
  blocked: ["cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

export class InvalidNavigationTransitionError extends Error {}

export function transitionTask(
  task: NavigationTask,
  toStatus: NavigationStatus,
  triggerType: string,
  reasonCodes: string[],
  id: () => string,
  now: Date
): NavigationTransitionRecord {
  if (!allowedTransitions[task.status].includes(toStatus)) {
    throw new InvalidNavigationTransitionError(
      `Invalid navigation transition: ${task.status} -> ${toStatus}`
    );
  }
  const transition: NavigationTransitionRecord = {
    transitionId: `transition-${id()}`,
    taskId: task.taskId,
    attemptId: task.attemptId,
    fromStatus: task.status,
    toStatus,
    triggerType,
    reasonCodes,
    occurredAt: now.toISOString()
  };
  task.status = toStatus;
  task.reasonCodes = [...reasonCodes];
  task.transitionRecordRefs.push(transition.transitionId);
  return transition;
}
