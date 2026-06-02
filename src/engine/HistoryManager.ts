export interface Command {
  execute(): void;
  undo(): void;
  name: string;
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private onStateChangeCallbacks: (() => void)[] = [];

  constructor() {}

  public execute(command: Command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new command
    this.triggerStateChange();
  }

  public undo() {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
    this.triggerStateChange();
  }

  public redo() {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);
    this.triggerStateChange();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.triggerStateChange();
  }

  public subscribe(callback: () => void) {
    this.onStateChangeCallbacks.push(callback);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  private triggerStateChange() {
    this.onStateChangeCallbacks.forEach(cb => cb());
  }
}
