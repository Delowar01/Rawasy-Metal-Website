"use client";

import { Component, type ReactNode } from "react";

/**
 * One section of the preview that failed to draw (A5 brief §40): an admin-only placeholder with the section's label and
 * id, and the rest of the page goes on. The error itself is never shown (in production the browser receives none of its
 * details anyway); the server log keeps it.
 */
export class SectionBoundary extends Component<{ id: string; label: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="shell gb-failed" data-section={this.props.id} lang="en" dir="ltr">
        <div className="gb-missing">
          <span className="gb-note">
            Preview only — “{this.props.label}” ({this.props.id}) could not be drawn. Its other sections are shown; check its settings in the editor.
          </span>
        </div>
      </div>
    );
  }
}
