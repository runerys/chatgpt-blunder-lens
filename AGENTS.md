This repository uses .github/copilot-instructions.md as the single source of truth for coding-agent instructions.

Before making changes, read and follow:

- .github/copilot-instructions.md
- PROJECT.md
- README.md

Do not duplicate or override those instructions here.

If any instruction appears to conflict, prefer .github/copilot-instructions.md for implementation rules and PROJECT.md for product intent.
<!-- copilot-research-plan-implement: framework section -->
# AGENTS.md

This file provides guidance to GitHub Copilot when working with code in this repository.

## Repository Overview

This is the GitHub Copilot Research-Plan-Implement Framework - a structured workflow framework for AI-assisted software development. The framework emphasizes thorough research, detailed planning, and systematic implementation with persistent documentation.

## Commands

### Framework Installation & Setup
```bash
# Install framework in target repository
./setup.sh /path/to/target/repo
```

### Workflow Commands (in target repositories using this framework)
1. `/1_research_codebase` - Deep codebase exploration with parallel AI agents
2. `/2_create_plan` - Create detailed, phased implementation plans
3. `/3_implement_plan` - Execute plan systematically
4. `/4_validate_plan` - Verify implementation matches plan
5. `/5_save_progress` - Save work session state
6. `/6_resume_work` - Resume from saved session
7. `/7_research_cloud` - Read-only cloud infrastructure analysis
8. `/8_define_test_cases` - Design acceptance test cases (comment-first DSL) before implementation

## High-Level Architecture

### Framework Structure
```
copilot-research-plan-implement/
├── .github/
│   ├── agents/                            # Specialized AI agent definitions
│   │   ├── codebase-locator.agent.md      # Finds relevant files efficiently
│   │   ├── codebase-analyzer.agent.md     # Analyzes code implementation details
│   │   └── codebase-pattern-finder.agent.md # Identifies patterns to follow
│   └── prompts/                           # Numbered workflow slash-commands
│       └── [1-8]_*.prompt.md              # Each phase of the workflow
├── thoughts/                              # Persistent context storage
│   └── shared/
│       ├── research/                      # Research findings (NNN_*.md)
│       ├── plans/                         # Implementation plans
│       ├── sessions/                      # Work session summaries
│       └── cloud/                         # Cloud infrastructure analyses
├── AGENTS.md                              # This file (primary instructions)
├── PLAYBOOK.md                            # Comprehensive guide
├── README.md                              # Quick start guide
└── setup.sh                               # Automated installation script
```

### Key Architectural Concepts

1. **Parallel Agent System**: The research phase spawns multiple specialized AI agents that work concurrently to explore different aspects of a codebase, dramatically improving research speed and thoroughness.

2. **Persistent Context Storage**: All research findings, plans, and session summaries are stored as markdown files in the `thoughts/` directory, building a knowledge base over time that persists across GitHub Copilot sessions.

3. **Phased Workflow**: The numbered commands enforce a structured approach: Research → Plan → Implement → Validate → Save/Resume. Each phase builds on the previous ones.

4. **Framework Agnostic**: The setup.sh script customizes the framework for JavaScript, Python, Go, or other projects, generating appropriate AGENTS.md templates and command customizations.

5. **Session Management**: Commands 5 and 6 allow saving and resuming work state, enabling long-running tasks to span multiple GitHub Copilot sessions.

### Integration Points

- **Prompt System**: Each `.github/prompts/*.prompt.md` file defines a slash prompt that modifies GitHub Copilot's behavior for that specific workflow phase
- **Agent Definitions**: The `.github/agents/*.agent.md` files define specialized sub-agents with focused capabilities
- **Documentation Templates**: The framework creates template files for research findings and plans to ensure consistency

### Usage in Target Repositories

When this framework is installed in a target repository:
1. Developers invoke numbered commands to progress through the workflow
2. Research findings accumulate in `thoughts/shared/research/`
3. Implementation plans are saved to `thoughts/shared/plans/`
4. The framework guides systematic, well-documented development
5. All context persists between GitHub Copilot sessions for continuity
<!-- copilot-research-plan-implement: framework section -->
