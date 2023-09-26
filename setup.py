import os
import setuptools

readme = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'README.md')

setuptools.setup(
    name='omphaloskepsis',
    version='0.0.1',
    packages=setuptools.find_packages(),
    author='lmjohns3',
    author_email='lmjohns3@gmail.com',
    description='Quantified self logging and inspection',
    long_description=open(readme).read(),
    license='MIT',
    keywords='quantified self',
    url='http://github.com/lmjohns3/omphaloskepsis/',
    entry_points='[console_scripts]\nomphaloskepsis=omphaloskepsis.cli:cli',
    classifiers=[
        'Environment :: Console',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ])
