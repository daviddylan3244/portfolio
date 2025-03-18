import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Portfolio.css';

function Resume() {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: 'black', minHeight: '100vh', color: 'white' }}>
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
        <div className="contact-section">
          <h1>David Dylan Martínez-Dimnet Díaz-Velarde</h1>
          <p className="location">Boston, MA</p>
          <div className="social-links">
            <a href="https://www.linkedin.com/in/david-martinez-dimnet-25b842295/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </div>
        </div>

        <div className="resume-section">
          <h2>Experience</h2>
          
          <div className="experience-item">
            <div className="exp-header">
              <h3>Growth Rocket LLC</h3>
              <span>Boston,MA</span>
            </div>
            <div className="exp-subheader">
              <p>Chief Marketing Officer</p>
              <span>January 2025 – Present</span>
            </div>
            <ul>
              <li>• Developed and implemented a new marketing strategy to revitalize a stagnating company, collaborating with team members to drive growth</li>
              <li>• Currently spearheading the creation of a news spotlight campaign to increase company exposure and attract new clients</li>
            </ul>
          </div>

          <div className="experience-item">
            <div className="exp-header">
              <h3>The Huntington News</h3>
              <span>Boston, MA</span>
            </div>
            <div className="exp-subheader">
              <p>Photography Staff</p>
              <span>Deicenber 2024 – Present</span>
            </div>
            <ul>
              <li>• Contributed to a student-run newspaper, providing on-call photography support for headshots, news strories, and editorials </li>
              <li>• Captured images for school-related sports games, events, and student-affiliated activities, while also contributing to stories in the Lifestyles, Sports, and City section of the paper</li>
            </ul>
          </div>

          <div className="experience-item">
            <div className="exp-header">
              <h3>PAROMA Sailing Team</h3>
              <span>San Juan, PR</span>
            </div>
            <div className="exp-subheader">
              <p>Bowman</p>
              <span>August 2019 - Present</span>
            </div>
            <ul>
              <li>• Full-time crew member on the PAROMA vessel, participating in multiple regattas, including the BVI and USVI Spring International Regatta </li>
              <li>• Proficient in handling smaller vessels such as Optimist, Laser, 420, 470, and Hobie 16</li>
            </ul>
          </div>

          <div className="experience-item">
            <div className="exp-header">
              <h3>Sidex Suministros</h3>
              <span>Murcia, ES</span>
            </div>
            <div className="exp-subheader">
              <p>Industrial Design Internship</p>
              <span>May 2019 - July 2023</span>
            </div>
            <ul>
              <li>• Gained a comprehensive understanding of industrial design software and its applications in the work of an industrial engineer, using MTPro as the main designing software</li>
              <li>• Learned advanced construction methods using extruded aluminum and was able to work in the shop putting together blueprints for clients while as well completing sales</li>
            </ul>
          </div>

          <div className="experience-item">
            <div className="exp-header">
              <h3>La Luz Verde</h3>
              <span>San Juan, PR</span>
            </div>
            <div className="exp-subheader">
              <p>Author/Editor</p>
              <span>August 2021 - May 2022</span>
            </div>
            <ul>
              <li>• Co-founded the school's first all-Spanish newspaper in collaboration with the head of the Spanish department as well as authored and collaborated in numerous articles relating to school activities </li>
            </ul>
          </div>
        </div>

        <div className="resume-section">
          <h2>Education</h2>
          
          <div className="education-item">
            <div className="edu-header">
              <h3>Northeastern University, D'Amore-McKim School of Business</h3>
              <span>Boston, MA</span>
            </div>
            <div className="edu-subheader">
              <p>Candidate for BS in Business Administration and Design</p>
              <span>May 2027</span>
            </div>
            <p>Concentrations: Marketing & Finance</p>
            <p>GPA: 3.3</p>
            <p>Activities: Intermural Soccer, Club Squash, Northeastern Electric Racing, The Huntington News </p>
            <p className="courses">Relevant Courses: Financial Accounting and Reporting; Macroeconomics; Interactive Design Principles; Business Statistics; Financial Management; Marketing Research</p>
          </div>

          <div className="education-item">
            <div className="edu-header">
              <h3>American University of Paris</h3>
              <span>Paris, FR</span>
            </div>
            <div className="edu-subheader">
              <p>Summer Study Abroad</p>
              <span>July 2022 - August 2023</span>
            </div>
            <p className="courses">Courses: EU & its Discontents and Advanced Photography</p>
          </div>

          <div className="education-item">
            <div className="edu-header">
              <h3>Saint John's School</h3>
              <span>San Juan, PR</span>
            </div>
            <div className="edu-subheader">
              <p>High School Diploma</p>
              <span>June 2023</span>
            </div>
            <p>Awards & Activities: Saint John's School Honors 7-12th Grade Swimming team; <i>La Luz Verde</i> Newspaper</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Resume; 