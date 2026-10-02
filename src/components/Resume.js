import React, { useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';

const HEADSHOT_SRC = encodeURI('/photos/Website digital/Resume/Headshop-1.jpg');

function Resume() {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = HEADSHOT_SRC;
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <div className="bg-level-3" style={{ minHeight: '100vh', color: 'white' }}>
      <div className="header-container">
        <div className="header-nav">
          <button
            className="header-button"
            onClick={() => navigate('/portfolio')}
          >
            Portfolio
          </button>
          <button
            className="header-button"
            onClick={() => navigate('/store')}
          >
            Store
          </button>
        </div>
        <span
          className="header-logo"
          onClick={() => navigate('/')}
        >
          RETURN HOME
        </span>
      </div>
      <div className="resume-container">
        <h1 className="resume-name">David Dylan <span className="resume-name-part">Martínez-Dimnet</span> <span className="resume-name-part">Díaz-Velarde</span></h1>
        <div className="resume-intro">
          <div className="resume-portrait-frame">
            <img
              src={HEADSHOT_SRC}
              alt="David Dylan Martinez-Dimnet"
              className="resume-portrait"
              fetchPriority="high"
              loading="eager"
            />
          </div>
          <div className="contact-section">
            <p className="location">Boston, MA</p>
            <div className="social-links">
              <div>
                <a href="mailto:martinezdimnet.d@northeastern.edu">martinezdimnet.d@northeastern.edu</a>
              </div>
              <div>
                <a className="linkedin-link" href="https://www.linkedin.com/in/david-martinez-dimnet-25b842295/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              </div>
            </div>
            <p className="resume-bio">I'm pursuing a Bachelor's in Business & Design, concentrating in Marketing and Finance with a minor in Law and Policy. As a problem solver, I apply everything I've learned from the incredible people I'm fortunate to call my friends. Right now, I'm focused on product design, merchandising, and advertising, while learning new software tools and coding languages. My goal is to start an advertising company that creates something the industry hasn't seen before.</p>
          </div>
        </div>

        <section className="resume-section" aria-labelledby="experience-heading">
          <h2 id="experience-heading">Experience</h2>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Photography & Retouching Co-op</h3>
              <p className="resume-role-meta">JCDecaux North America · New York City</p>
              <p className="resume-role-dates">July – December 2025</p>
            </header>
            <p className="resume-role-intro">JCDecaux is one of the world's largest outdoor advertising companies, behind the billboards, bus shelters, and street displays seen in cities around the world.</p>
            <ul>
              <li>Worked within the marketing department producing photography and short-form video that supported the sales team's client deliverables, turning live campaigns into visual assets that helped win and retain business.</li>
              <li>Covered fast-moving, time-sensitive events, including store openings, live performances, and product launches, delivering finished content on tight deadlines alongside the creative team.</li>
              <li>Created "beauty shots" for clients who purchased post-buy creative services: polished, carefully retouched photographs of their advertisements in the real world, which clients use to showcase their campaigns in context.</li>
              <li>Handled the full workflow from capture to final edit using Adobe Photoshop, Lightroom Classic, and Premiere Pro.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Intern</h3>
              <p className="resume-role-meta">Billboard Media Group · San Juan, Puerto Rico</p>
              <p className="resume-role-dates">2018 – Present</p>
            </header>
            <p className="resume-role-intro">BMG is my mother's outdoor advertising company, a relatively small fish in the overall outdoor media market.</p>
            <ul>
              <li>Was first introduced to graphic design through my mother, who taught me everything she knew during my free time.</li>
              <li>Started out working weekends on installations, helping put up smaller banners and display tarps for clients.</li>
              <li>Helped wherever I could over the years, often handling different parts of the business.</li>
              <li>Combined my drone piloting skills and love for photography to capture high-quality aerial shots of clients' advertisements, a service I've also provided for other outdoor media companies.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Photography Staff & Writer</h3>
              <p className="resume-role-meta">The Huntington News · Boston</p>
              <p className="resume-role-dates">December 2024 – Present</p>
            </header>
            <p className="resume-role-intro">The Huntington News is Northeastern University's independent, student-run newspaper.</p>
            <ul>
              <li>Photograph sports games, campus events, and student activities, with my images published in six articles to date.</li>
              <li>Write and contribute to stories across the Lifestyle, Sports, and City sections, including published articles under my own byline.</li>
              <li>Work on both sides of the story, as a photographer capturing the moment and as a writer shaping how it's told.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Chief Marketing Officer</h3>
              <p className="resume-role-meta">Growth Rocket LLC · Boston</p>
              <p className="resume-role-dates">June – December 2024</p>
            </header>
            <p className="resume-role-intro">Growth Rocket is a friend's startup built around guerrilla-style marketing, helping mom-and-pop shops across the Boston area build a stronger social media presence.</p>
            <ul>
              <li>Co-led a full revitalization of the company's marketing strategy, rethinking how it presented itself in order to accelerate growth.</li>
              <li>Led client outreach, building and delivering pitches tailored to each prospective client's needs to expand the client base and open new business opportunities.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Industrial Design Intern</h3>
              <p className="resume-role-meta">Sidex Suministros · Murcia, Spain</p>
              <p className="resume-role-dates">May 2019 – July 2023</p>
            </header>
            <p className="resume-role-intro">Sidex Suministros is my father's industrial design company, specializing in extruded aluminum for all kinds of applications, and an official retailer of Bosch products.</p>
            <ul>
              <li>Learned industrial design software in a real engineering setting, using MTPro as the primary design tool and seeing how designs translate into production.</li>
              <li>Gained hands-on experience with advanced construction methods using extruded aluminum, working in the shop to assemble projects from client blueprints.</li>
              <li>Supported the sales side of the business, seeing projects through from design to completed sale.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Bowman</h3>
              <p className="resume-role-meta">PAROMA Sailing Team · San Juan, Puerto Rico</p>
              <p className="resume-role-dates">August 2019 – Present</p>
            </header>
            <p className="resume-role-intro">PAROMA is an official sailing team in the Performance Cruiser class, racing aboard a Salona 44.</p>
            <ul>
              <li>Crew the bow of the PAROMA racing yacht, the position responsible for sail changes, spinnaker work, and calling the start line, where timing and communication with the rest of the crew are critical.</li>
              <li>Have competed in multiple regattas, including the BVI and USVI Spring International Regattas.</li>
              <li>Experienced across a range of smaller boats, including the Optimist, Laser, 420, 470, and Hobie 16.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Co-Founder, Author & Editor</h3>
              <p className="resume-role-meta">La Luz Verde · San Juan, Puerto Rico</p>
              <p className="resume-role-dates">August 2021 – May 2022</p>
            </header>
            <p className="resume-role-intro">La Luz Verde was an initiative with the Spanish department to bring an all-Spanish newspaper to an American school.</p>
            <ul>
              <li>Co-founded Saint John's School's first all-Spanish newspaper, working directly with the head of the Spanish department to launch it.</li>
              <li>Wrote, edited, and collaborated on numerous articles covering school life and activities.</li>
            </ul>
          </article>
        </section>

        <section className="resume-section" aria-labelledby="education-heading">
          <h2 id="education-heading">Education</h2>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Northeastern University</h3>
              <p className="resume-role-meta">Boston, MA</p>
              <p className="resume-role-dates">Expected May 2027</p>
            </header>
            <p className="resume-note">D'Amore-McKim School of Business & College of Arts, Media and Design</p>
            <p className="resume-note">Bachelor of Business Administration and Design · Concentrations in Finance & Marketing · Minor in Law and Policy</p>
            <p className="resume-note">Relevant coursework: Financial Accounting and Reporting, Financial Management, Investments, Profit Analysis and Managerial Accounting, Macroeconomics, Business Statistics, and Law and Policy.</p>
            <p className="resume-note">Activities: Northeastern Electric Racing, The Huntington News, Case Institute, Club Squash, and Intramural Soccer.</p>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>The American University of Paris</h3>
              <p className="resume-role-meta">Paris, France</p>
              <p className="resume-role-dates">July – August 2022</p>
            </header>
            <p className="resume-note">Non-degree summer coursework in Political Science and Government · Grade: A</p>
            <ul>
              <li>Completed two 4-credit university courses while still in high school: Europe and Its Discontents (LW2033), taught by Professor Kerstin Bree Carlson, and Photography (AR1061), taught by Professor Paul McCarthy.</li>
              <li>Both courses offered a depth of learning I've rarely encountered, shaped by exceptional teaching and a genuinely engaged classroom environment.</li>
            </ul>
          </article>

          <article className="resume-role">
            <header className="resume-role-head">
              <h3>Saint John's School</h3>
              <p className="resume-role-meta">San Juan, PR</p>
              <p className="resume-role-dates">June 2023</p>
            </header>
            <p className="resume-note">Honor Roll · Varsity Swim Team (2018–2023) · AP Seminar and Research Certificate</p>
          </article>
        </section>

        <section className="resume-section" aria-labelledby="skills-heading">
          <h2 id="skills-heading">Skills</h2>
          <div className="resume-card">
          <div className="skill-group">
            <h3>Photo & video</h3>
            <p>Adobe Photoshop, Lightroom Classic, Premiere Pro, After Effects</p>
          </div>
          <div className="skill-group">
            <h3>Design & engineering</h3>
            <p>Autodesk Fusion 360, SolidWorks, MTPro</p>
          </div>
          <div className="skill-group">
            <h3>Business & marketing</h3>
            <p>Microsoft Office, Google Workspace, Google Ads (certified in Measurement, AI-Powered Performance, and Creative)</p>
          </div>
          <div className="skill-group">
            <h3>Languages</h3>
            <p>English and Spanish, both native</p>
          </div>
          <div className="skill-group">
            <h3>Other certifications</h3>
            <p>Open Water Diver, Power Squadron</p>
          </div>
          </div>
        </section>

        <section className="resume-section" aria-labelledby="outside-heading">
          <h2 id="outside-heading">Outside of Work</h2>
          <div className="resume-card">
            <p className="outside-copy">I'm into foiling, repairing analog cameras, 3D printing, contract law, Latin American history, and equity research & valuation.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Resume;
