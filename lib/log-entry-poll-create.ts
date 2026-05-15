import type { Prisma } from "@/app/generated/prisma/client";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";

export type PollCreateBody = {
  question: string;
  allowMultiple: boolean;
  responseScope: LogEntryPollResponseScope;
  optionLabels: string[];
  inviteeUserIds?: string[];
};

/** Invitados válidos (miembros activos del departamento) para alcance SELECTED_USERS. */
export function collectInviteeIdsForSelectedUsers(
  responseScope: LogEntryPollResponseScope,
  inviteeUserIds: string[] | undefined,
  deptMemberIds: Set<string>
): string[] {
  if (responseScope !== LogEntryPollResponseScope.SELECTED_USERS) return [];
  return [...new Set((inviteeUserIds ?? []).filter((id) => deptMemberIds.has(id)))];
}

export async function createLogEntryPollInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    logEntryId: string;
    createdById: string;
    poll: PollCreateBody;
    validatedInviteeIds: string[];
  }
): Promise<{ id: string }> {
  const { logEntryId, createdById, poll, validatedInviteeIds } = input;
  const p = await tx.logEntryPoll.create({
    data: {
      logEntryId,
      question: poll.question.trim(),
      allowMultiple: poll.allowMultiple,
      responseScope: poll.responseScope,
      createdById,
      options: {
        create: poll.optionLabels.map((label, i) => ({
          label: label.trim(),
          sortOrder: i,
        })),
      },
    },
  });
  if (
    poll.responseScope === LogEntryPollResponseScope.SELECTED_USERS &&
    validatedInviteeIds.length > 0
  ) {
    await tx.logEntryPollInvitee.createMany({
      data: validatedInviteeIds.map((userId) => ({ pollId: p.id, userId })),
      skipDuplicates: true,
    });
  }
  return { id: p.id };
}
