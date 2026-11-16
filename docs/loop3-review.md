# Loop 3: Visual Review Loop (Kane Vision QA on Video Edits)

**Autocast AI Tagline:** *Demos that can't lie.*  
Not only does Kane CLI verify the live web application (Loop 1), Kane CLI also acts as our autonomous Video Quality Assurance Director (Loop 3), visually verifying the rendered video edit before it ships.

---

## Why Loop 3 Is Essential

Traditional DOM tests cannot detect visual presentation defects:
- An element might exist in the DOM, but be clipped off by an incorrect container scale or aspect ratio.
- A camera zoom might push key UI controls outside the visible canvas.
- A dynamic sidebar might overlap, wrap awkwardly, or collide with video elements.

Kane CLI's multimodal vision agent inspects the rendered Remotion frames served through `/review?frame=<N>`, evaluating layout containment, aspect ratio integrity, and typography readability just like a human creative director.

---

## Architecture of Loop 3

```
                     [ Storyboard Compiled ]
                                |
                                v
               [ Remotion Still Frame Renderer ]
                                |
             +------------------+------------------+
             |                                     |
    Frame 115 (Dashboard)                Frame 260 (Modal Review)
             |                                     |
             v                                     v
   http://localhost:8080/                http://localhost:8080/
      review?frame=115                      review?frame=260
             |                                     |
             +------------------+------------------+
                                |
                                v
                   [ Kane CLI Vision Agent ]
         "Verify layout stays fully within browser frame
          and workflow sidebar text does not overlap"
                                |
               +----------------+----------------+
               |                                 |
           [ Passed ]                       [ Flawed ]
               |                                 |
               v                                 v
     Proceed to Final Render             Halt & Report Defect
       (out/demo.mp4)                     (Keep artifacts)
```

---

## Live Verification Log

In our end-to-end pipeline run (`npm run demo`), Kane CLI audited the rendered video frames:

### 1. Frame 115: Dashboard Overview (Wide Shot)
- **Objective:**
  ```bash
  kane-cli run "Open http://localhost:8080/review?frame=115 and verify that the application layout is properly contained inside the browser window without being cropped off at the edges, and verify the workflow sidebar on the right shows the step title without text overlap." --url http://localhost:8080/review?frame=115 --headless --agent
  ```
- **Kane Verdict:** `PASSED`
  > *"Reviewed the application page to confirm that the layout stayed fully within the browser window. Confirmed that the workflow sidebar’s step title was readable and did not overlap other text. The review completed successfully, with both layout and sidebar display checks passing."*

### 2. Frame 260: Invoice Modal Details Inspection
- **Objective:**
  ```bash
  kane-cli run "Open http://localhost:8080/review?frame=260 and verify that the application layout is properly contained inside the browser window without being cropped off at the edges, and verify the workflow sidebar on the right shows the step title without text overlap." --url http://localhost:8080/review?frame=260 --headless --agent
  ```
- **Kane Verdict:** `PASSED`
  > *"Reviewed the application page to confirm that the layout stays fully within the browser window. Checked the workflow sidebar on the right and confirmed that its step title is visible and does not overlap with other text. The review was completed successfully."*

---

## Frame Gallery

Verified review frames:
- `out/review/frame-115.png`: Full dashboard contained in 1320×743 browser frame, step 1 highlighted in sidebar.
- `out/review/demo-scene3.png`: Centered invoice modal detailing line items and payment terms.
- `out/review/demo-scene5.png`: Green compliance seal with Director sign-off stamp.
- `out/review/demo-scene6.png`: Reconciled invoice ledger with green "Approved" status badge.
