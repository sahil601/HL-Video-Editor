import { Project } from '../types/project';

export interface HistoryItem {
  project: Project;
  description: string;
  timestamp: number;
}

export class HistoryManager {
  private undoStack: HistoryItem[] = [];
  private redoStack: HistoryItem[] = [];
  private maxDepth: number = 50;

  constructor(maxDepth: number = 50) {
    this.maxDepth = maxDepth;
  }

  public push(project: Project, description: string): void {
    // Deep clone to guarantee immutability
    const snapshot: HistoryItem = {
      project: JSON.parse(JSON.stringify(project)),
      description,
      timestamp: Date.now(),
    };

    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // Clear redo stack on new operation
    this.redoStack = [];
  }

  public undo(currentProject: Project): { project: Project; description: string } | null {
    if (this.undoStack.length === 0) return null;

    // Push current state to redo
    this.redoStack.push({
      project: JSON.parse(JSON.stringify(currentProject)),
      description: 'Redo state',
      timestamp: Date.now(),
    });

    const previous = this.undoStack.pop()!;
    return {
      project: JSON.parse(JSON.stringify(previous.project)),
      description: previous.description,
    };
  }

  public redo(currentProject: Project): { project: Project; description: string } | null {
    if (this.redoStack.length === 0) return null;

    // Push current state back to undo
    this.undoStack.push({
      project: JSON.parse(JSON.stringify(currentProject)),
      description: 'Undo state',
      timestamp: Date.now(),
    });

    const next = this.redoStack.pop()!;
    return {
      project: JSON.parse(JSON.stringify(next.project)),
      description: next.description,
    };
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
