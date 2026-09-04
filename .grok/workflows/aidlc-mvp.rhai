let meta = #{
    name: "aidlc-mvp",
    description: "AIDLC MVP slice: PO then SA, human gate, BE, FE, QA",
    when_to_use: "Implement one milestone unit with specialist agents",
    phases: [
        #{ title: "Ideation", detail: "PO stories" },
        #{ title: "Inception", detail: "SA contracts" },
        #{ title: "Construction", detail: "BE then FE" },
        #{ title: "QA", detail: "fail-closed checks" },
    ],
};

let po_schema = #{
    "type": "object",
    "required": ["artifact_path", "issue_title", "summary"],
    "properties": #{
        "artifact_path": #{ "type": "string" },
        "issue_title": #{ "type": "string" },
        "summary": #{ "type": "string" },
    },
};
let sa_schema = #{
    "type": "object",
    "required": ["artifact_path", "adr_changed", "summary"],
    "properties": #{
        "artifact_path": #{ "type": "string" },
        "adr_changed": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
    },
};
let impl_schema = #{
    "type": "object",
    "required": ["files", "summary"],
    "properties": #{
        "files": #{ "type": "array", "items": #{ "type": "string" } },
        "summary": #{ "type": "string" },
    },
};
let qa_schema = #{
    "type": "object",
    "required": ["artifact_path", "passed", "failed_cases"],
    "properties": #{
        "artifact_path": #{ "type": "string" },
        "passed": #{ "type": "boolean" },
        "failed_cases": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

let intent = if args == () { () } else { args.intent };
if intent == () { pause("verification", "Pass args.intent — the unit or milestone to run (e.g. M1-auth)."); }
let intent_json = json_encode(intent);

phase("Ideation");
let po_prompt = "You are the PO agent for ai-gen-free. Read AGENTS.md, docs/architecture.md, docs/adr/, docs/domain/, and aidlc/README.md using read_file. ";
po_prompt += "Write docs/product/" + intent + ".md with user-visible behavior, Given/When/Then acceptance, out of scope, and QA checks. ";
po_prompt += "Do not edit apps/ or prisma/. Unit intent JSON: " + intent_json;
let po = agent(po_prompt, #{
    label: "PO",
    agent_type: "po",
    capability_mode: "read-write",
    output_schema: po_schema,
});
if po == () || !po.success { complete(#{ ok: false, stage: "po", reason: "PO agent failed" }); }

phase("Inception");
let sa_prompt = "You are the SA agent for ai-gen-free. Read AGENTS.md, docs/adr/, prisma/schema.prisma, and the PO artifact ";
if po.output.artifact_path != () {
    sa_prompt += po.output.artifact_path;
} else {
    sa_prompt += "docs/product/" + intent + ".md";
}
sa_prompt += " using read_file. Write docs/product/" + intent + ".contract.md with API errors, job/wallet invariants, and BE vs FE file ownership. ";
sa_prompt += "If a locked ADR must change, add a new ADR file and set adr_changed true. Do not implement apps/. Intent JSON: " + intent_json;
let sa = agent(sa_prompt, #{
    label: "SA",
    agent_type: "sa",
    capability_mode: "read-write",
    output_schema: sa_schema,
});
if sa == () || !sa.success { complete(#{ ok: false, stage: "sa", reason: "SA agent failed" }); }

await_user("user", "Approve PO + SA artifacts, then resume. Construction starts only after this gate.");

phase("Construction");
let be_prompt = "You are the BE agent. Read AGENTS.md and ";
if sa.output.artifact_path != () {
    be_prompt += sa.output.artifact_path;
} else {
    be_prompt += "docs/product/" + intent + ".contract.md";
}
be_prompt += " plus docs/adr/0003-single-session.md, docs/adr/0004-job-concurrency-cooldown.md, docs/adr/0008-credits-hold.md. ";
be_prompt += "Implement only apps/api, apps/worker, packages/, prisma/, docker-compose.yml as needed for intent " + intent + ". ";
be_prompt += "Never edit apps/web. Hold/capture/release and 202 jobs are mandatory if this unit touches generate or points.";
let be = agent(be_prompt, #{
    label: "BE",
    agent_type: "be",
    capability_mode: "all",
    output_schema: impl_schema,
});
if be == () || !be.success { complete(#{ ok: false, stage: "be", reason: "BE agent failed" }); }

let fe_prompt = "You are the FE agent. Read AGENTS.md, the PO story docs/product/" + intent + ".md, and the SA contract. ";
fe_prompt += "Implement only apps/web. Poll jobs; do not long-wait HTTP; no localStorage tokens; no Siray/Prisma imports. Intent: " + intent;
let fe = agent(fe_prompt, #{
    label: "FE",
    agent_type: "fe",
    capability_mode: "all",
    output_schema: impl_schema,
});
if fe == () || !fe.success { complete(#{ ok: false, stage: "fe", reason: "FE agent failed" }); }

phase("QA");
let qa_prompt = "You are the QA agent. Read AGENTS.md mandatory cases. Inspect the code BE/FE just wrote using read_file and grep. ";
qa_prompt += "Write docs/qa/" + intent + ".md. Set passed=true only if every applicable mandatory case has file evidence. Fail closed. Intent: " + intent;
let qa = agent(qa_prompt, #{
    label: "QA",
    agent_type: "qa",
    capability_mode: "all",
    output_schema: qa_schema,
});
if qa == () || !qa.success { complete(#{ ok: false, stage: "qa", reason: "QA agent failed" }); }

let passed = qa.output.passed == true;
complete(#{
    ok: passed,
    intent: intent,
    po: po.output,
    sa: sa.output,
    be: be.output,
    fe: fe.output,
    qa: qa.output,
});
