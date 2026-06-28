# Research-Plan-Implement Framework for GitHub Copilot - Playbook

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Framework Architecture](#framework-architecture)
4. [Workflow Phases](#workflow-phases)
5. [Prompt Reference](#prompt-reference)
6. [Session Management](#session-management)
7. [Subagent Reference](#subagent-reference)
8. [Best Practices](#best-practices)
9. [Customization Guide](#customization-guide)
10. [Troubleshooting](#troubleshooting)
11. [Advanced Usage](#advanced-usage)
12. [Conclusion](#conclusion)

## Overview

The Research-Plan-Implement Framework is a structured approach to AI-assisted software development for **GitHub Copilot** that emphasizes:
- **Thorough research** before coding
- **Detailed planning** with clear phases
- **Systematic implementation** with verification
- **Persistent context** through Markdown documentation
- **Parallel subagents** during research

It works identically in **VS Code Copilot** and **Copilot CLI** by using GitHub Copilot's native customization surfaces:

| Concept | File pattern | Location |
|---|---|---|
| Workflow slash-commands | `*.prompt.md` | `.github/prompts/` |
| Custom subagents | `*.agent.md` | `.github/agents/` |
| Repo-wide instructions | `AGENTS.md` | repo root |
| Persistent context | `*.md` | `thoughts/shared/` |

### Core Benefits
- 🔍 **Deep Understanding**: Research phase ensures complete context
- 📋 **Clear Planning**: Detailed plans prevent scope creep
- ✅ **Quality Assurance**: Built-in validation at each step
- 📚 **Knowledge Building**: Documentation accumulates over time
- ⚡ **Parallel Processing**: Multiple AI agents work simultaneously
- 🧪 **Test-Driven Development**: Design test cases following existing patterns before implementation

## Quick Start

### Installation

1. **Run setup.sh:**
```bash
# From this framework repo, install into your target repo
./setup.sh /path/to/your/repo
```

The installer creates `.github/prompts/`, `.github/agents/`, `AGENTS.md`, and `thoughts/shared/{research,plans,sessions,cloud}/` in the target repo.

2. **Customize for your project:**

Before first use, tailor the framework to your stack:

- **Edit `.github/prompts/*.prompt.md`** to match your project's tooling (test/lint/build commands, success criteria).
- **Update subagent descriptions** in `.github/agents/*.agent.md` if you want to specialize them.
- **Add project conventions** to `AGENTS.md` (Testing, Code Style, Git Workflow, etc.) - see [Customization Guide](#customization-guide) for examples.

3. **Test the workflow:**

**Standard Approach:**
```
/1_research_codebase
> How does user authentication work in this codebase?

/2_create_plan
> I need to add two-factor authentication

/3_implement_plan
> thoughts/shared/plans/two_factor_auth.md
```

**Test-Driven Approach:**
```
/8_define_test_cases
> Two-factor authentication for user login

# Design tests, then implement feature
/3_implement_plan
> Implement 2FA to make tests pass
```

## Framework Architecture

```
your-repo/
├── .github/
│   ├── agents/                            # Subagents
│   │   ├── codebase-locator.agent.md
│   │   ├── codebase-analyzer.agent.md
│   │   └── codebase-pattern-finder.agent.md
│   └── prompts/                           # Workflow slash-commands
│       ├── 1_research_codebase.prompt.md
│       ├── 2_create_plan.prompt.md
│       ├── 3_implement_plan.prompt.md
│       ├── 4_validate_plan.prompt.md
│       ├── 5_save_progress.prompt.md
│       ├── 6_resume_work.prompt.md
│       ├── 7_research_cloud.prompt.md
│       └── 8_define_test_cases.prompt.md
├── AGENTS.md
└── thoughts/
    └── shared/
        ├── research/    # 001_topic.md, 002_…
        ├── plans/       # 001_feature.md
        ├── sessions/    # 001_feature.md
        └── cloud/       # 001_platform.md
```

## Workflow Phases

### Phase 1: Research (`/1_research_codebase`)

**Purpose**: Comprehensive exploration and understanding.

**Process**:
1. Invoke with a research question.
2. The prompt dispatches `codebase-locator`, `codebase-analyzer`, and `codebase-pattern-finder` **in parallel** via the `agent` tool.
3. Findings are synthesized and saved as `thoughts/shared/research/NNN_topic.md`.

**Example**:
```
/1_research_codebase
> How does the payment processing system work?
```

**Output**: Detailed research document with:
- Code references (file:line)
- Architecture insights
- Patterns and conventions
- Related components

### Phase 2: Planning (`/2_create_plan`)

**Purpose**: Produce a detailed, phased plan with measurable success criteria.

**Process**:
1. Read requirements and research
2. Interactive planning with user
3. Generate phased approach
4. Save to `thoughts/shared/plans/`

**Example**:
```
/2_create_plan
> Add Stripe payment integration based on the research
```

**Plan Structure**:
```markdown
# Feature Implementation Plan

## Phase 1: Database Setup
### Changes Required:
- Add payment tables
- Migration scripts

### Success Criteria:
#### Automated:
- [ ] Migration runs successfully
- [ ] Tests pass

#### Manual:
- [ ] Data integrity verified

## Phase 2: API Integration
[...]
```

Saved as `thoughts/shared/plans/NNN_feature.md`.

### Phase 3: Implementation (`/3_implement_plan`)

**Purpose**: Execute plan systematically

**Process**:
1. Read plan and track with todos
2. Implement phase by phase
3. Run verification after each phase
4. Update plan checkboxes

**Example**:
```
/3_implement_plan
> thoughts/shared/plans/stripe_integration.md
```

**Progress Tracking**:
- Uses checkboxes in plan
- TodoWrite for task management
- Communicates blockers clearly

### Phase 4: Validation (`/4_validate_plan`)

**Purpose**: Verify implementation matches plan

**Process**:
1. Review git changes
2. Run all automated checks
3. Generate validation report
4. Identify deviations
5. Prepare for manual commit process

**Example**:
```
/4_validate_plan
> Validate the Stripe integration implementation
```

**Report Includes**:
- Implementation status
- Test results
- Code review findings
- Manual testing requirements

### Test-Driven Development (`/8_define_test_cases`)

**Purpose**: Design acceptance test cases before implementation

**Process**:
1. Invoke command with feature description
2. AI researches existing test patterns in codebase
3. Defines test cases in structured comment format
4. Identifies required DSL functions
5. Notes which DSL functions exist vs. need creation

**Example**:
```
/8_define_test_cases
> Partner enrollment workflow when ordering kit products
```

**Output**:
1. **Test Case Definitions**: All scenarios in comment format:
```javascript
// 1. New Customer Orders Partner Kit

// newCustomer
// partnerKitInCart
//
// customerPlacesOrder
//
// expectOrderCreated
// expectPartnerCreatedInExigo
```

2. **DSL Function List**: Organized by type (setup/action/assertion)
3. **Pattern Notes**: How tests align with existing patterns

**Test Structure**:
- Setup phase (arrange state)
- Blank line
- Action phase (trigger behavior)
- Blank line
- Assertion phase (verify outcomes)
- No "Given/When/Then" labels - implicit structure

**Coverage Areas**:
- Happy paths
- Edge cases
- Error scenarios
- Boundary conditions
- Authorization/permission checks

**Key Principle**: Comment-first approach - design tests as specifications before any implementation.

## Command Reference

### Core Workflow Prompts

### `/1_research_codebase`
- **Purpose**: Deep dive into codebase
- **Input**: A research question.
- **Output**: `thoughts/shared/research/NNN_topic.md`
- **Subagents used**: all three, in parallel.

### `/2_create_plan`
- **Purpose**: Create implementation plan
- **Input**: A feature description, ticket, or reference to research.
- **Output**: `thoughts/shared/plans/NNN_feature.md`
- **Interactive**: Yes - asks clarifying questions.

### `/3_implement_plan`
- **Purpose**: Execute implementation
- **Input**: A plan path.
- **Output**: Code changes + plan checkbox updates.

### `/4_validate_plan`
- **Purpose**: Verify implementation
- **Input**: A plan path (or auto-detect most recent).
- **Output**: Validation report (returned in chat).

## Session Management

The framework supports saving and resuming work through persistent documentation:

### `/5_save_progress`
- **Purpose**: Save work progress and context
- **Input**: Optional note about why you're stopping.
- **Output**: `thoughts/shared/sessions/NNN_feature.md`

### `/6_resume_work`
- **Purpose**: Resume previously saved work
- **Input**: A session path (or auto-discover).
- **Output**: Restored context, ready to continue.

### `/7_research_cloud`
- **Purpose**: Analyze cloud infrastructure (READ-ONLY)
- **Input**: Cloud platform and focus area.
- **Output**: `thoughts/shared/cloud/NNN_platform_env.md`
- **Safety**: READ-ONLY operations only.

### `/8_define_test_cases`
- **Purpose**: Design acceptance test cases using DSL approach
- **Input**: Feature/functionality to test
- **Output**: Test case comment definitions + DSL function inventory.
- **Subagent used**: `codebase-pattern-finder`.

## Session Management

Plans use checkboxes (`- [ ]` / `- [x]`) as the source of truth for progress. `/5_save_progress` writes a session summary; `/6_resume_work` reads it, replays the working state (stashes, branch, last commit), and resumes at the first unchecked item.

Session summary structure:

```markdown
---
date: …
feature: …
plan: thoughts/shared/plans/001_feature.md
status: in_progress
last_commit: <hash>
---

# Session Summary: …
## Accomplishments / Discoveries / Open Questions / Ready to Resume
```

## Subagent Reference

### codebase-locator
- **Role**: Find relevant files (no content reading).
- **Tools**: `search/codebase`, `search/fileSearch`, `search/textSearch`, `search/listDirectory`
- **Returns**: Categorized file listings.

### codebase-analyzer
- **Role**: Understand implementation (reads files thoroughly).
- **Tools**: `search/codebase`, `search/fileSearch`, `search/textSearch`, `search/listDirectory`, `search/usages`, `read/readFile`
- **Returns**: Data-flow analysis, dependencies, integration points.

### codebase-pattern-finder
- **Role**: Find concrete examples to model new code after.
- **Tools**: `search/codebase`, `search/fileSearch`, `search/textSearch`, `search/listDirectory`, `search/usages`, `read/readFile`
- **Returns**: Code snippets, naming conventions, file organization.

All three are marked `user-invocable: false` - they're invoked from prompts via the `agent/runSubagent` tool, not from the agent dropdown.

## Best Practices

### 1. Research First
- Always start with research for complex features
- Don't skip research even if you think you know the codebase
- Research documents become valuable references

### 2. Plan Thoroughly
- Break work into testable phases
- Include specific success criteria
- Document what's NOT in scope
- Resolve all questions before finalizing
- Consider how work will be committed

### 3. Implement Systematically
- Complete one phase before starting next
- Run tests after each phase
- Update plan checkboxes as you go
- Communicate blockers immediately

### 4. Document Everything
- Research findings persist in `thoughts/`
- Plans serve as technical specs
- Session summaries maintain continuity

### 5. Use Parallel Agents
- Spawn multiple agents for research
- Let them work simultaneously
- Combine findings for comprehensive view

### 6. Design Tests Early
- Define test cases before implementing features
- Follow existing test patterns and DSL conventions
- Use comment-first approach for test specifications
- Ensure tests cover happy paths, edge cases, and errors
- Let tests guide implementation

## Customization Guide

### Adapting Prompts to Your Project

Edit the relevant `.github/prompts/*.prompt.md` file. Common changes:

1. **Remove framework-specific references:**
```markdown
# Before (cli project specific)
Run `cli thoughts sync`

# After (Generic)
Save to thoughts/shared/research/
```

2. **Adjust tool commands:**
```markdown
# Match your project's tooling
- Tests: `npm test` → `yarn test`
- Lint: `npm run lint` → `make lint`
- Build: `npm run build` → `cargo build`
```

3. **Customize success criteria:**
```markdown
# Add project-specific checks
- [ ] Security scan passes: `npm audit`
- [ ] Performance benchmarks met
- [ ] Documentation generated
```

4. **Restrict tool access** via the `tools:` field in frontmatter - for example, remove `execute/runInTerminal` from prompts that should never execute shell commands.

5. **Add an `agent:` field** in a prompt's frontmatter to lock it to a specific custom agent.

### Adding Custom Subagents

Drop a new `.agent.md` file in `.github/agents/`. Example for a security-focused analyzer:

```markdown
---
name: security-analyzer
description: Analyzes security implications and surfaces risky patterns
tools: ['search/codebase', 'search/textSearch', 'search/fileSearch', 'search/usages', 'read/readFile']
user-invocable: false
---

You are a security specialist. Your job is to identify potential vulnerabilities, insecure patterns, and risky dependencies in the code you are asked to review…
```

Then invoke it from a prompt via the `agent/runSubagent` tool by name.

### Project-Specific Instructions

Project conventions belong in the **target repository's** `AGENTS.md` (Copilot, Claude, Gemini, and other agentic tools all read it). The installer appends a framework section but leaves your project content intact. A typical project-conventions block looks like:

```markdown
# Project Conventions

## Testing
- Always write tests first (TDD)
- Minimum 80% coverage required
- Use Jest for unit tests, Playwright for E2E

## Code Style
- Use Prettier formatting
- Follow ESLint rules
- Prefer functional programming

## Git Workflow
- Feature branches from `develop`
- Squash commits on merge
- Conventional commit messages (`feat:`, `fix:`, `chore:` …)
```

For **path-scoped** conventions, create `.github/instructions/NAME.instructions.md` files with an `applyTo:` glob - VS Code Copilot applies them only when files matching the glob are in context.

## Troubleshooting

- A: Limit scope of research question
- Focus on specific component/feature
- Use more targeted queries

**Q: Plan too vague?**
- A: Request more specific details
- Ask for code examples
- Ensure success criteria are measurable

**Q: Implementation doesn't match plan?**
- A: Stop and communicate mismatch
- Update plan if needed
- Validate assumptions with research

**Q: How to commit changes?**
- A: Use git commands directly after validation
- Group related changes logically
- Write clear commit messages following project conventions

### Tips for Success

1. **Start Small**: Test with simple feature first
2. **Iterate**: Customize based on what works
3. **Build Library**: Accumulate research/plans over time
4. **Team Alignment**: Share framework with team
5. **Regular Reviews**: Update commands based on learnings

## Advanced Usage

### Chaining Prompts

For complex features, chain prompts end-to-end:

```
/1_research_codebase
> Research current auth system

/2_create_plan
> Based on the research, plan OAuth integration

/3_implement_plan
> thoughts/shared/plans/001_oauth_integration.md

/4_validate_plan
> Verify OAuth implementation

# Then commit using git directly
```

### Parallel Research

Research multiple aspects simultaneously by asking a compound question:

```
/1_research_codebase
> How do authentication, authorization, and user management work together?
```

This dispatches a subagent per aspect, in parallel.

### Cloud Infrastructure Analysis

Analyze cloud deployments without making changes:

```
/7_research_cloud
> Azure
> all

# Analyzes:
- Resource inventory and costs
- Security and compliance
- Architecture patterns
- Optimization opportunities
```

### Test-Driven Development Workflow

Design tests before implementation:

```
# Step 1: Define test cases
/8_define_test_cases
> Partner enrollment when customer orders a kit product

# Output includes:
# - Test cases in comment format (happy path, edge cases, errors)
# - List of DSL functions needed (setup/action/assertion)
# - Existing functions that can be reused

# Step 2: Implement missing DSL functions
# (Follow patterns discovered by the agent)

# Step 3: Write tests using the defined test cases
# (Copy comment structure to test files, add function calls)

# Step 4: Create plan for feature implementation
/2_create_plan
> Implement partner enrollment logic to make tests pass

# Step 5: Implement the feature
/3_implement_plan
> thoughts/shared/plans/partner_enrollment.md

# Step 6: Validate tests pass
/4_validate_plan
```

**Key Benefit**: Tests are designed with existing patterns in mind, ensuring consistency across the test suite.

## Conclusion

This framework provides structure without rigidity. It scales from simple features to complex architectural changes. The key is consistent use - the more you use it, the more valuable your `thoughts/` directory becomes as organizational knowledge.

Remember: the framework is a tool to enhance development, not replace thinking. Use it to augment your capabilities, not as a rigid process.
