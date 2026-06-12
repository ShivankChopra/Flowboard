# AI Usage Log

This document details how AI assistance was leveraged during the planning, implementation, and documentation phases of Flowboard. It outlines where the tools accelerated development and where engineering judgment was used to override, correct, or reject AI outputs.

---

## 1. Architecture & Planning

### How AI Was Used

The primary concern when using AI is context window management and usage limits. Any decision that digresses from the requirements in the early phases can roll into an undesired direction during implementation that can be hard to correct without expending excessive token usage. Therefore, I followed a step-by-step, waterfall-style planning approach for using AI to objectify and lock decisions at different abstraction levels—spanning from requirement analysis and architecture discussion to development plans, code implementation, and debugging.

The AI-assisted, locked decision documents can be found in the `/docs` folder of the project. They are intentionally named with a numeric order prefix to signify the chronological order of their creation:

- **01-task-requirements.md:** This document was the markdown equivalent of the provided task requirement PDF, serving as the original requirement context and product scope.
- **02-manual-analysis-decisions.md:** This document contains my manual, first-pass analysis of the requirements to pin down initial decisions so as to avoid back-and-forth friction between my core architectural choices and generic AI recommendations.
- **03-ai-audited-final-decisions.md:** This document recorded the final techno-product decisions for the project after reviewing the assignment constraints against the manual analysis. It served as the absolute source of truth for the full-stack implementation plan.
- **04-ai-audited-development-plan.md:** This document turned the product and technical choices into an actionable implementation plan executed in auditable chunks. The plan systematically covers the database schema, seed scripts, backend API, Docker configuration, frontend views, and focused tests in a single, consolidated reference.

---

## 2. Development and Implementation

The `04-ai-audited-development-plan.md` details the technical decisions, API contracts, screen contracts, database schema design, project directory structure, deployment/testing, and deferred technical decisions not covered in the current demo.

I intentionally broke execution down into small, isolated phases, yielding two critical benefits:

- **Manual Analysis at Every Step:** Pausing for manual analysis at every stage of the focused implementation helped me correct the AI at a root level. This allowed me to leverage my experience to set the proper code direction and stay intimately aware of low-level implementation details. After every phase, I was able to test, verify, and steer decisions focusing purely on deliverables and requirement coverage.
- **Better AI Context Budget Management:** Small phases could easily be spun up in entirely fresh AI sessions. Attempting the entire implementation in a single, continuous pass would quickly exhaust context windows and degrade code quality. Instead, at the start of every new session, I provided rigid system prompts like:
    > _"Phase 0 to Phase 5 are completed and manually reviewed/committed. Start at Phase 6 only, then stop for manual review before moving on to any future phases. This is highly critical."_
    > This approach successfully kept the context tight, minimized AI hallucination, and ensured decisive milestones were met cleanly.

---

## 3. How I corrected AI at multiple occasions

AI was corrected at every step when the direction was steered away from major requirements. The key was to have high signal-to-noise ratio, focussing on deliverables and requirement coverage and sensible decisions. Some of the real promts actually used in project are shared below as examples :

- `I am thinking, lets add migrate and seed script to run on every restart. Problem is code is being denied permissions, so best soln is to run these scripts on each restart for easy demo purposes. I think its even actually cleaner for demos as well.`
- `how about making prisma seed script modular, call those functions when nest application starts, and run it only when prod environment, same with static ui serving right now?`
- `Now in 01 doc, i noticed that a callout was done that show avatar initials (like trello) in kanban board, and priority should be shown as badges. based on current implementation do you think they can be beautified and made more prettier?`
- `Just something to ask, the 01 doc mentioned that we make lists also draggable in side tree, but that doesnt seem to be inside th eimplementation plan. I dont want to affect current flow, just check once for me. Dont do anything else`
- `Right now, error is captured as http error not logical error that is sent using code from server, can we make it so that proper descriptive messages as recieved from server can be shown, instead of simply request failed with status 400?`
